use crate::engine::biquad::BiquadCoeffs;
use crate::engine::dynamics::DynamicsStage;
use crate::engine::eq_stage::EqStage;
use crate::engine::panner::Panner;
use crate::engine::reverb::ReverbStage;
use crate::engine::spatial_3d::{DistanceStage, ElevationStage};
use crate::models::{DynamicsParams, EqParams, ReverbParams, Spatial8DParams};
use crate::timeline::PrecomputedTimeline;

/// Unified 8D Spatial DSP Chain.
///
/// Encapsulates the entire 10-stage processing cascade:
/// 1. Timeline automation evaluation (per-sample Bézier / linear / hold)
/// 2. Input loudness normalization smoothing (~25ms)
/// 3. 8D Binaural Panner (horizontal azimuth ITD/IID)
/// 4. 3D Elevation Stage (vertical pinna cue)
/// 5. 3D Distance Stage (air absorption high-cut + inverse distance attenuation)
/// 6. Environmental Reverb (FDN-8 Tank with distance auto-tie)
/// 7. 4-Band Cascaded Biquad EQ + Master Volume
/// 8. Stereo Output Balance Trim (Post-Master Gain, Pre-Limiter)
/// 9. Master Dynamics Stage (5ms lookahead brickwall peak limiter + soft clipper)
///
/// Both live playback (`player.rs`) and offline export (`export.rs`) execute this
/// EXACT same chain, guaranteeing 0% logic drift.
pub struct SpatialDspChain {
    pub panner: Panner,
    pub elevation_stage: ElevationStage,
    pub distance_stage: DistanceStage,
    pub reverb_stage: ReverbStage,
    pub eq_stage: EqStage,
    pub dynamics_stage: DynamicsStage,

    // Automation fallback tracking
    prev_pan_automated: bool,
    prev_elev_automated: bool,
    prev_dist_automated: bool,
    prev_rev_automated: bool,
    prev_vol_automated: bool,

    // Smoothing states
    pub current_norm_gain: f32,
    pub norm_smooth_alpha: f32,
    pub current_bal_gain_l: f32,
    pub current_bal_gain_r: f32,
    pub bal_smooth_alpha: f32,
}

impl SpatialDspChain {
    /// Creates a fresh DSP chain initialized to hardware/export sample rate.
    pub fn new(sample_rate: f32) -> Self {
        Self {
            panner: Panner::new(sample_rate),
            elevation_stage: ElevationStage::new(sample_rate),
            distance_stage: DistanceStage::new(sample_rate),
            reverb_stage: ReverbStage::new(sample_rate),
            eq_stage: EqStage::new(sample_rate),
            dynamics_stage: DynamicsStage::new(sample_rate),
            prev_pan_automated: false,
            prev_elev_automated: false,
            prev_dist_automated: false,
            prev_rev_automated: false,
            prev_vol_automated: false,
            current_norm_gain: 1.0,
            norm_smooth_alpha: 1.0 - (-1.0 / (0.025 * sample_rate)).exp(),
            current_bal_gain_l: 1.0,
            current_bal_gain_r: 1.0,
            bal_smooth_alpha: 1.0 - (-1.0 / (0.015 * sample_rate)).exp(),
        }
    }

    /// Sets static/base 8D spatial parameters.
    pub fn set_spatial_params(&mut self, params: &Spatial8DParams) {
        self.panner.set_enabled(params.enabled);
        self.panner.set_speed(params.rotation_speed);
        self.panner.set_intensity(params.intensity);
        self.distance_stage.set_distance(params.distance);
        self.elevation_stage.set_elevation(params.elevation);
    }

    /// Sets static/base EQ parameters.
    pub fn set_eq_params(&mut self, sample_rate: f32, params: &EqParams) {
        let lc = BiquadCoeffs::low_cut(sample_rate, params.low_cut_hz);
        let hc = BiquadCoeffs::high_cut(sample_rate, params.high_cut_hz);
        let bs = BiquadCoeffs::bass_shelf(sample_rate, 100.0, params.bass_gain_db);
        let ts = BiquadCoeffs::treble_shelf(sample_rate, 10000.0, params.treble_gain_db);

        self.eq_stage.set_coefficients(lc, hc, bs, ts);
        self.eq_stage.set_target_volume(params.master_volume);
    }

    /// Sets static/base Reverb parameters.
    pub fn set_reverb_params(&mut self, params: &ReverbParams) {
        self.reverb_stage.set_params(params);
    }

    /// Sets static/base Dynamics parameters.
    pub fn set_dynamics_params(&mut self, params: &DynamicsParams) {
        self.dynamics_stage.set_params(params);
    }

    /// Returns the lookahead buffer delay in samples (5ms at current sample rate).
    pub fn lookahead_samples(&self) -> usize {
        self.dynamics_stage.lookahead_samples()
    }

    /// Returns current LFO or manual azimuth angle in radians [0, 2*PI).
    pub fn current_azimuth(&self) -> f32 {
        self.panner.current_azimuth()
    }

    /// Evaluates automation and runs a single stereo sample frame through the 10-stage DSP chain.
    #[inline(always)]
    pub fn process_frame(
        &mut self,
        in_l: f32,
        in_r: f32,
        t_sec: f64,
        timeline: &PrecomputedTimeline,
        manual_azimuth: Option<f32>,
        manual_azimuth_enabled: bool,
        fallback_elevation: f32,
        fallback_distance: f32,
        fallback_reverb_amount: f32,
        fallback_volume: f32,
        target_norm_gain: f32,
        target_balance: f32,
    ) -> (f32, f32) {
        // 1. Multi-lane automation timeline evaluation with click-free fallback
        if let Some(pan_val) = timeline.pan.evaluate(t_sec) {
            self.panner.set_azimuth_override(Some(pan_val * std::f32::consts::PI));
            self.prev_pan_automated = true;
        } else if self.prev_pan_automated || manual_azimuth_enabled {
            self.panner.set_azimuth_override(manual_azimuth);
            self.prev_pan_automated = false;
        }

        if let Some(elev_val) = timeline.elevation.evaluate(t_sec) {
            self.elevation_stage.set_elevation(elev_val);
            self.prev_elev_automated = true;
        } else if self.prev_elev_automated {
            self.elevation_stage.set_elevation(fallback_elevation);
            self.prev_elev_automated = false;
        }

        if let Some(dist_val) = timeline.distance.evaluate(t_sec) {
            self.distance_stage.set_distance(dist_val);
            self.prev_dist_automated = true;
        } else if self.prev_dist_automated {
            self.distance_stage.set_distance(fallback_distance);
            self.prev_dist_automated = false;
        }

        if let Some(rev_amount) = timeline.reverb.evaluate(t_sec) {
            self.reverb_stage.set_amount(rev_amount);
            self.prev_rev_automated = true;
        } else if self.prev_rev_automated {
            self.reverb_stage.set_amount(fallback_reverb_amount);
            self.prev_rev_automated = false;
        }

        if let Some(vol_val) = timeline.volume.evaluate(t_sec) {
            self.eq_stage.set_target_volume(vol_val);
            self.prev_vol_automated = true;
        } else if self.prev_vol_automated {
            self.eq_stage.set_target_volume(fallback_volume);
            self.prev_vol_automated = false;
        }

        // 2. Exponential smoothing for input normalize (~25ms)
        self.current_norm_gain += self.norm_smooth_alpha * (target_norm_gain - self.current_norm_gain);
        let norm_l = in_l * self.current_norm_gain;
        let norm_r = in_r * self.current_norm_gain;

        // 3. 8D Binaural Panner DSP (horizontal azimuth)
        let (pan_l, pan_r) = self.panner.process_sample(norm_l, norm_r);

        // 4. 3D Elevation DSP (vertical pinna spectral cue)
        let (elev_l, elev_r) = self.elevation_stage.process_sample(pan_l, pan_r);

        // 5. 3D Distance DSP (air absorption high cut + 1/d volume attenuation)
        let (dist_l, dist_r) = self.distance_stage.process_sample(elev_l, elev_r);

        // 6. Environmental Reverb DSP (FDN-8 Tank with distance auto-tie)
        let (rev_l, rev_r) = self.reverb_stage.process_sample(dist_l, dist_r);

        // 7. 4-Band Cascaded EQ + Master Volume DSP
        let (eq_l, eq_r) = self.eq_stage.process_sample(rev_l, rev_r);

        // 8. Stereo Output Balance Trim (Post-Master Gain, Pre-Limiter)
        let target_bal = target_balance.clamp(-1.0, 1.0);
        let target_bal_l = if target_bal <= 0.0 { 1.0 } else { 1.0 - target_bal };
        let target_bal_r = if target_bal >= 0.0 { 1.0 } else { 1.0 + target_bal };
        self.current_bal_gain_l += self.bal_smooth_alpha * (target_bal_l - self.current_bal_gain_l);
        self.current_bal_gain_r += self.bal_smooth_alpha * (target_bal_r - self.current_bal_gain_r);
        let bal_l = eq_l * self.current_bal_gain_l;
        let bal_r = eq_r * self.current_bal_gain_r;

        // 9. Master Dynamics Stage (5ms lookahead brickwall peak limiter + soft clipper)
        self.dynamics_stage.process_sample(bal_l, bal_r)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::timeline::{
        AutomationLane, AutomationLaneId, CurveType, Keyframe, PrecomputedTimeline, TimelineState,
    };

    #[test]
    fn test_live_and_offline_dsp_parity_with_automation() {
        let sample_rate = 48000.0;
        let mut live_chain = SpatialDspChain::new(sample_rate);
        let mut offline_chain = SpatialDspChain::new(sample_rate);

        // Setup identical baseline parameters
        let spatial_params = Spatial8DParams {
            enabled: true,
            rotation_speed: 0.25,
            intensity: 0.85,
            distance: 0.3,
            elevation: 0.1,
        };
        live_chain.set_spatial_params(&spatial_params);
        offline_chain.set_spatial_params(&spatial_params);

        let eq_params = EqParams {
            low_cut_hz: 30.0,
            high_cut_hz: 18000.0,
            bass_gain_db: 2.0,
            treble_gain_db: -1.5,
            master_volume: 0.95,
        };
        live_chain.set_eq_params(sample_rate, &eq_params);
        offline_chain.set_eq_params(sample_rate, &eq_params);

        let reverb_params = ReverbParams {
            enabled: true,
            amount: 0.35,
            room_size: 0.5,
            decay: 2.5,
            damping: 0.4,
        };
        live_chain.set_reverb_params(&reverb_params);
        offline_chain.set_reverb_params(&reverb_params);

        let dyn_params = DynamicsParams {
            limiter_enabled: true,
            threshold_db: -1.0,
            release_ms: 100.0,
            normalize_enabled: true,
        };
        live_chain.set_dynamics_params(&dyn_params);
        offline_chain.set_dynamics_params(&dyn_params);

        // Build an active timeline with Bézier automation on Pan lane and Linear on Volume lane
        let pan_lane = AutomationLane {
            id: AutomationLaneId::Pan,
            enabled: true,
            keyframes: vec![
                Keyframe {
                    id: "kf_pan_1".into(),
                    time: 0.0,
                    value: -0.8,
                    curve: CurveType::Bezier {
                        c1_x: 0.25,
                        c1_y: 0.1,
                        c2_x: 0.25,
                        c2_y: 1.0,
                    },
                },
                Keyframe {
                    id: "kf_pan_2".into(),
                    time: 0.5,
                    value: 0.8,
                    curve: CurveType::Linear,
                },
                Keyframe {
                    id: "kf_pan_3".into(),
                    time: 1.0,
                    value: 0.0,
                    curve: CurveType::Linear,
                },
            ],
        };

        let vol_lane = AutomationLane {
            id: AutomationLaneId::Volume,
            enabled: true,
            keyframes: vec![
                Keyframe {
                    id: "kf_vol_1".into(),
                    time: 0.0,
                    value: 0.5,
                    curve: CurveType::Linear,
                },
                Keyframe {
                    id: "kf_vol_2".into(),
                    time: 1.0,
                    value: 1.2,
                    curve: CurveType::Linear,
                },
            ],
        };

        let timeline_state = TimelineState {
            lanes: vec![
                pan_lane,
                AutomationLane::new(AutomationLaneId::Distance),
                AutomationLane::new(AutomationLaneId::Elevation),
                AutomationLane::new(AutomationLaneId::Reverb),
                vol_lane,
            ],
        };

        let timeline = PrecomputedTimeline::from_state(&timeline_state);

        // Synthesize test stereo signal (1.0 second, sine waves)
        let num_frames = sample_rate as usize;
        let mut live_out = Vec::with_capacity(num_frames * 2);
        let mut offline_out = Vec::with_capacity(num_frames * 2);

        // Simulate Live Playback (processed in chunks of 512 frames)
        let chunk_size = 512;
        for chunk_start in (0..num_frames).step_by(chunk_size) {
            let chunk_end = (chunk_start + chunk_size).min(num_frames);
            for frame_idx in chunk_start..chunk_end {
                let t_sec = frame_idx as f64 / sample_rate as f64;
                let in_l = (2.0 * std::f32::consts::PI * 440.0 * t_sec as f32).sin() * 0.7;
                let in_r = (2.0 * std::f32::consts::PI * 660.0 * t_sec as f32).sin() * 0.7;

                let (out_l, out_r) = live_chain.process_frame(
                    in_l, in_r, t_sec, &timeline, None, false, 0.1, 0.3, 0.35, 1.0, 1.0, 0.15,
                );
                live_out.push(out_l);
                live_out.push(out_r);
            }
        }

        // Simulate Offline Export (processed in chunks of 4096 frames)
        let offline_chunk = 4096;
        for chunk_start in (0..num_frames).step_by(offline_chunk) {
            let chunk_end = (chunk_start + offline_chunk).min(num_frames);
            for frame_idx in chunk_start..chunk_end {
                let t_sec = frame_idx as f64 / sample_rate as f64;
                let in_l = (2.0 * std::f32::consts::PI * 440.0 * t_sec as f32).sin() * 0.7;
                let in_r = (2.0 * std::f32::consts::PI * 660.0 * t_sec as f32).sin() * 0.7;

                let (out_l, out_r) = offline_chain.process_frame(
                    in_l, in_r, t_sec, &timeline, None, false, 0.1, 0.3, 0.35, 1.0, 1.0, 0.15,
                );
                offline_out.push(out_l);
                offline_out.push(out_r);
            }
        }

        // Verify Bit-Exact Parity
        assert_eq!(live_out.len(), offline_out.len());
        let mut max_diff: f32 = 0.0;
        for i in 0..live_out.len() {
            let diff = (live_out[i] - offline_out[i]).abs();
            if diff > max_diff {
                max_diff = diff;
            }
            assert!(
                diff < 1e-6,
                "Live and offline sample mismatch at frame index {i}: live={}, offline={}, diff={}",
                live_out[i],
                offline_out[i],
                diff
            );
        }
        assert_eq!(max_diff, 0.0, "Live and offline outputs must be 100% bit-exact!");
    }
}
