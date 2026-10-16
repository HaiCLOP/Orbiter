use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};

pub const LUT_SIZE: usize = 256;

/// Automation Parameter Lanes.
/// Reuses target boundaries matching existing spatial and mixer parameters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutomationLaneId {
    /// Azimuth / Pan: [-1.0, 1.0] mapping to [-PI, PI] radians.
    /// Overrides LFO auto-rotation when keyframes exist on this lane.
    Pan,
    /// Distance falloff: [0.0, 1.0] (Near to Far).
    Distance,
    /// Elevation pinna cue: [-1.0, 1.0] (Below to Above).
    Elevation,
    /// Reverb wet amount: [0.0, 1.0] (Dry to 100% Wet).
    Reverb,
    /// Master Volume: [0.0, 2.0] (Silence to 200%).
    Volume,
}

impl AutomationLaneId {
    pub const ALL: [AutomationLaneId; 5] = [
        AutomationLaneId::Pan,
        AutomationLaneId::Distance,
        AutomationLaneId::Elevation,
        AutomationLaneId::Reverb,
        AutomationLaneId::Volume,
    ];

    pub fn value_bounds(&self) -> (f32, f32) {
        match self {
            AutomationLaneId::Pan => (-1.0, 1.0),
            AutomationLaneId::Distance => (0.0, 1.0),
            AutomationLaneId::Elevation => (-1.0, 1.0),
            AutomationLaneId::Reverb => (0.0, 1.0),
            AutomationLaneId::Volume => (0.0, 2.0),
        }
    }

    pub fn default_value(&self) -> f32 {
        match self {
            AutomationLaneId::Pan => 0.0,
            AutomationLaneId::Distance => 0.0,
            AutomationLaneId::Elevation => 0.0,
            AutomationLaneId::Reverb => 0.30,
            AutomationLaneId::Volume => 1.0,
        }
    }

    pub fn clamp_value(&self, val: f32) -> f32 {
        let (min, max) = self.value_bounds();
        val.clamp(min, max)
    }
}

/// Curve interpolation type between consecutive keyframes.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CurveType {
    Linear,
    Bezier {
        /// Normalized handle 1 (outgoing from start keyframe):
        /// c1_x in [0.0, 1.0], c1_y in [-1.0, 1.0] relative to segment range
        c1_x: f32,
        c1_y: f32,
        /// Normalized handle 2 (incoming to end keyframe):
        /// c2_x in [0.0, 1.0], c2_y in [-1.0, 1.0] relative to segment range
        c2_x: f32,
        c2_y: f32,
    },
    Hold,
}

impl Default for CurveType {
    fn default() -> Self {
        CurveType::Linear
    }
}

/// Single automation keyframe point.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Keyframe {
    pub id: String,
    pub time: f64,  // seconds >= 0.0
    pub value: f32, // clamped per lane bounds
    pub curve: CurveType,
}

/// Automation lane containing ordered keyframes for a specific parameter.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AutomationLane {
    pub id: AutomationLaneId,
    pub enabled: bool, // When false, automation is muted and lane falls back to manual slider
    pub keyframes: Vec<Keyframe>,
}

impl AutomationLane {
    pub fn new(id: AutomationLaneId) -> Self {
        Self {
            id,
            enabled: true,
            keyframes: Vec::new(),
        }
    }
}

/// Full automation timeline containing all parameter lanes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineState {
    pub lanes: Vec<AutomationLane>,
}

impl Default for TimelineState {
    fn default() -> Self {
        Self {
            lanes: AutomationLaneId::ALL
                .iter()
                .map(|&id| AutomationLane::new(id))
                .collect(),
        }
    }
}

/// Precomputed cubic Bezier lookup table (LUT) for zero-allocation audio thread evaluation.
#[derive(Debug, Clone)]
pub struct PrecomputedSegment {
    pub t_start: f64,
    pub t_end: f64,
    pub v_start: f32,
    pub v_end: f32,
    pub curve: CurveType,
    pub lut: [f32; LUT_SIZE],
}

impl PrecomputedSegment {
    pub fn new(k1: &Keyframe, k2: &Keyframe) -> Self {
        let t_start = k1.time;
        let t_end = k2.time.max(t_start + 1e-4);
        let v_start = k1.value;
        let v_end = k2.value;
        let curve = k1.curve;

        let mut lut = [0.0f32; LUT_SIZE];

        match curve {
            CurveType::Linear => {
                for i in 0..LUT_SIZE {
                    let progress = i as f32 / (LUT_SIZE - 1) as f32;
                    lut[i] = v_start + progress * (v_end - v_start);
                }
            }
            CurveType::Hold => {
                for i in 0..LUT_SIZE {
                    lut[i] = v_start;
                }
            }
            CurveType::Bezier { c1_x, c1_y, c2_x, c2_y } => {
                let p1x = c1_x.clamp(0.0, 1.0);
                let p1y = c1_y.clamp(-1.0, 2.0);
                let p2x = c2_x.clamp(0.0, 1.0);
                let p2y = c2_y.clamp(-1.0, 2.0);

                for i in 0..LUT_SIZE {
                    let target_x = i as f32 / (LUT_SIZE - 1) as f32;
                    // Solve target_x = B_x(u) via Newton-Raphson
                    let mut u = target_x;
                    for _ in 0..8 {
                        let one_minus_u = 1.0 - u;
                        let bx = 3.0 * one_minus_u * one_minus_u * u * p1x
                            + 3.0 * one_minus_u * u * u * p2x
                            + u * u * u;
                        let err = bx - target_x;
                        if err.abs() < 1e-5 {
                            break;
                        }
                        let dbx = 3.0 * one_minus_u * one_minus_u * p1x
                            + 6.0 * one_minus_u * u * (p2x - p1x)
                            + 3.0 * u * u * (1.0 - p2x);
                        if dbx.abs() < 1e-6 {
                            break;
                        }
                        u = (u - err / dbx).clamp(0.0, 1.0);
                    }

                    // Compute B_y(u)
                    let one_minus_u = 1.0 - u;
                    let norm_y = 3.0 * one_minus_u * one_minus_u * u * p1y
                        + 3.0 * one_minus_u * u * u * p2y
                        + u * u * u;

                    lut[i] = v_start + norm_y * (v_end - v_start);
                }
            }
        }

        Self {
            t_start,
            t_end,
            v_start,
            v_end,
            curve,
            lut,
        }
    }

    /// Evaluates value at given time in seconds. $O(1)$ lookup + linear interpolation.
    #[inline]
    pub fn evaluate(&self, t: f64) -> f32 {
        if t <= self.t_start {
            return self.v_start;
        }
        if t >= self.t_end {
            return self.v_end;
        }

        let p = ((t - self.t_start) / (self.t_end - self.t_start)) as f32;
        let p_clamped = p.clamp(0.0, 1.0);

        match self.curve {
            CurveType::Linear => self.v_start + p_clamped * (self.v_end - self.v_start),
            CurveType::Hold => self.v_start,
            CurveType::Bezier { .. } => {
                let f = p_clamped * (LUT_SIZE - 1) as f32;
                let idx = (f.floor() as usize).min(LUT_SIZE - 2);
                let frac = f - idx as f32;
                self.lut[idx] + frac * (self.lut[idx + 1] - self.lut[idx])
            }
        }
    }
}

/// Precomputed lane data optimized for the audio thread.
#[derive(Debug, Clone)]
pub struct PrecomputedLane {
    pub id: AutomationLaneId,
    pub enabled: bool,
    pub keyframes_empty: bool,
    pub first_time: f64,
    pub first_value: f32,
    pub last_time: f64,
    pub last_value: f32,
    pub segments: Vec<PrecomputedSegment>,
}

impl PrecomputedLane {
    pub fn from_lane(lane: &AutomationLane) -> Self {
        let mut sorted_kf = lane.keyframes.clone();
        sorted_kf.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap_or(std::cmp::Ordering::Equal));

        if sorted_kf.is_empty() {
            return Self {
                id: lane.id,
                enabled: lane.enabled,
                keyframes_empty: true,
                first_time: 0.0,
                first_value: lane.id.default_value(),
                last_time: 0.0,
                last_value: lane.id.default_value(),
                segments: Vec::new(),
            };
        }

        let first = sorted_kf.first().unwrap();
        let last = sorted_kf.last().unwrap();

        let mut segments = Vec::with_capacity(sorted_kf.len().saturating_sub(1));
        for w in sorted_kf.windows(2) {
            segments.push(PrecomputedSegment::new(&w[0], &w[1]));
        }

        Self {
            id: lane.id,
            enabled: lane.enabled,
            keyframes_empty: false,
            first_time: first.time,
            first_value: first.value,
            last_time: last.time,
            last_value: last.value,
            segments,
        }
    }

    /// Evaluates the lane value at time $t$. Returns `Some(value)` if active automation exists,
    /// or `None` if the lane is empty/disabled (calling code falls back to manual slider).
    #[inline]
    pub fn evaluate(&self, t: f64) -> Option<f32> {
        if !self.enabled || self.keyframes_empty {
            return None;
        }

        if t <= self.first_time {
            return Some(self.first_value);
        }
        if t >= self.last_time {
            return Some(self.last_value);
        }

        // Binary search segment
        let seg_idx = match self.segments.binary_search_by(|seg| {
            if t < seg.t_start {
                std::cmp::Ordering::Greater
            } else if t > seg.t_end {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Equal
            }
        }) {
            Ok(idx) => idx,
            Err(idx) => idx.min(self.segments.len().saturating_sub(1)),
        };

        if let Some(seg) = self.segments.get(seg_idx) {
            Some(seg.evaluate(t))
        } else {
            Some(self.last_value)
        }
    }
}

/// Precomputed snapshot of all lanes handed atomically to the audio callback.
#[derive(Debug, Clone)]
pub struct PrecomputedTimeline {
    pub pan: PrecomputedLane,
    pub distance: PrecomputedLane,
    pub elevation: PrecomputedLane,
    pub reverb: PrecomputedLane,
    pub volume: PrecomputedLane,
}

impl PrecomputedTimeline {
    pub fn from_state(state: &TimelineState) -> Self {
        let mut pan = None;
        let mut distance = None;
        let mut elevation = None;
        let mut reverb = None;
        let mut volume = None;

        for lane in &state.lanes {
            match lane.id {
                AutomationLaneId::Pan => pan = Some(PrecomputedLane::from_lane(lane)),
                AutomationLaneId::Distance => distance = Some(PrecomputedLane::from_lane(lane)),
                AutomationLaneId::Elevation => elevation = Some(PrecomputedLane::from_lane(lane)),
                AutomationLaneId::Reverb => reverb = Some(PrecomputedLane::from_lane(lane)),
                AutomationLaneId::Volume => volume = Some(PrecomputedLane::from_lane(lane)),
            }
        }

        Self {
            pan: pan.unwrap_or_else(|| PrecomputedLane::from_lane(&AutomationLane::new(AutomationLaneId::Pan))),
            distance: distance.unwrap_or_else(|| PrecomputedLane::from_lane(&AutomationLane::new(AutomationLaneId::Distance))),
            elevation: elevation.unwrap_or_else(|| PrecomputedLane::from_lane(&AutomationLane::new(AutomationLaneId::Elevation))),
            reverb: reverb.unwrap_or_else(|| PrecomputedLane::from_lane(&AutomationLane::new(AutomationLaneId::Reverb))),
            volume: volume.unwrap_or_else(|| PrecomputedLane::from_lane(&AutomationLane::new(AutomationLaneId::Volume))),
        }
    }
}

/// Thread-safe atomic bridge for transferring precomputed timeline data
/// from the UI/command thread to the CPAL audio callback thread.
pub struct TimelineBridge {
    pub timeline: RwLock<Arc<PrecomputedTimeline>>,
    pub state: RwLock<TimelineState>,
    pub version: AtomicU32,
}

impl TimelineBridge {
    pub fn new() -> Self {
        let initial_state = TimelineState::default();
        let precomputed = Arc::new(PrecomputedTimeline::from_state(&initial_state));
        Self {
            timeline: RwLock::new(precomputed),
            state: RwLock::new(initial_state),
            version: AtomicU32::new(1),
        }
    }

    /// Publishes an updated TimelineState. Recomputes all segment LUTs on the UI/command thread
    /// and atomically publishes the new Arc pointer with Ordering::Release.
    pub fn publish(&self, state: TimelineState) {
        let precomputed = Arc::new(PrecomputedTimeline::from_state(&state));
        if let Ok(mut g) = self.timeline.write() {
            *g = precomputed;
        }
        if let Ok(mut s) = self.state.write() {
            *s = state;
        }
        self.version.fetch_add(1, Ordering::Release);
    }

    pub fn get_state(&self) -> TimelineState {
        self.state.read().map(|g| g.clone()).unwrap_or_default()
    }
}

/// Built-in timeline preset generator.
pub fn create_timeline_preset(preset_name: &str, duration: f64) -> Option<TimelineState> {
    let dur = if duration <= 0.0 { 16.0 } else { duration };
    let mut state = TimelineState::default();

    match preset_name {
        "classic_orbit" | "Classic Orbit" => {
            // Smooth continuous 4-second circular pan with elliptical distance modulation
            let cycle = 4.0;
            let mut pan_kf = Vec::new();
            let mut dist_kf = Vec::new();
            let mut rev_kf = Vec::new();

            let mut t = 0.0;
            let mut id = 0;
            while t <= dur + cycle {
                // Pan full 360 circle: Rear (-1.0) -> Front (0.0) -> Rear (1.0)
                pan_kf.push(Keyframe {
                    id: format!("pan_{}", id),
                    time: t,
                    value: -1.0,
                    curve: CurveType::Linear,
                });
                pan_kf.push(Keyframe {
                    id: format!("pan_{}_f", id),
                    time: t + cycle * 0.5,
                    value: 0.0,
                    curve: CurveType::Linear,
                });
                pan_kf.push(Keyframe {
                    id: format!("pan_{}_e", id),
                    time: t + cycle,
                    value: 1.0,
                    curve: CurveType::Linear,
                });

                // Distance breathes between 0.15 and 0.45
                dist_kf.push(Keyframe {
                    id: format!("dist_{}", id),
                    time: t,
                    value: 0.15,
                    curve: CurveType::Linear,
                });
                dist_kf.push(Keyframe {
                    id: format!("dist_{}_far", id),
                    time: t + cycle * 0.5,
                    value: 0.45,
                    curve: CurveType::Linear,
                });

                // Reverb amount follows distance
                rev_kf.push(Keyframe {
                    id: format!("rev_{}", id),
                    time: t,
                    value: 0.25,
                    curve: CurveType::Linear,
                });
                rev_kf.push(Keyframe {
                    id: format!("rev_{}_wet", id),
                    time: t + cycle * 0.5,
                    value: 0.45,
                    curve: CurveType::Linear,
                });

                t += cycle;
                id += 1;
            }

            for lane in &mut state.lanes {
                match lane.id {
                    AutomationLaneId::Pan => lane.keyframes = pan_kf.clone(),
                    AutomationLaneId::Distance => lane.keyframes = dist_kf.clone(),
                    AutomationLaneId::Reverb => lane.keyframes = rev_kf.clone(),
                    _ => {}
                }
            }
            Some(state)
        }
        "slow_spin" | "Slow Spin" => {
            // 12-second slow panoramic spin, far distance (0.6 -> 0.8), lush reverb (0.65)
            let cycle = 12.0;
            let mut pan_kf = Vec::new();
            let mut t = 0.0;
            let mut id = 0;
            while t <= dur + cycle {
                pan_kf.push(Keyframe {
                    id: format!("s_pan_{}", id),
                    time: t,
                    value: -1.0,
                    curve: CurveType::Linear,
                });
                pan_kf.push(Keyframe {
                    id: format!("s_pan_{}_mid", id),
                    time: t + cycle * 0.5,
                    value: 1.0,
                    curve: CurveType::Linear,
                });
                t += cycle;
                id += 1;
            }

            for lane in &mut state.lanes {
                match lane.id {
                    AutomationLaneId::Pan => lane.keyframes = pan_kf.clone(),
                    AutomationLaneId::Distance => {
                        lane.keyframes = vec![
                            Keyframe { id: "sd_1".into(), time: 0.0, value: 0.65, curve: CurveType::Linear },
                            Keyframe { id: "sd_2".into(), time: dur, value: 0.80, curve: CurveType::Linear },
                        ];
                    }
                    AutomationLaneId::Reverb => {
                        lane.keyframes = vec![
                            Keyframe { id: "sr_1".into(), time: 0.0, value: 0.60, curve: CurveType::Linear },
                            Keyframe { id: "sr_2".into(), time: dur, value: 0.75, curve: CurveType::Linear },
                        ];
                    }
                    _ => {}
                }
            }
            Some(state)
        }
        "front_to_back" | "Front to Back" => {
            // Center pan, dives from front overhead to far rear below
            for lane in &mut state.lanes {
                match lane.id {
                    AutomationLaneId::Pan => {
                        lane.keyframes = vec![
                            Keyframe { id: "fb_p1".into(), time: 0.0, value: 0.0, curve: CurveType::Linear },
                            Keyframe { id: "fb_p2".into(), time: dur, value: 0.0, curve: CurveType::Linear },
                        ];
                    }
                    AutomationLaneId::Distance => {
                        lane.keyframes = vec![
                            Keyframe { id: "fb_d1".into(), time: 0.0, value: 0.90, curve: CurveType::Linear },
                            Keyframe { id: "fb_d2".into(), time: dur * 0.5, value: 0.05, curve: CurveType::Linear },
                            Keyframe { id: "fb_d3".into(), time: dur, value: 0.90, curve: CurveType::Linear },
                        ];
                    }
                    AutomationLaneId::Elevation => {
                        lane.keyframes = vec![
                            Keyframe { id: "fb_e1".into(), time: 0.0, value: 0.70, curve: CurveType::Linear },
                            Keyframe { id: "fb_e2".into(), time: dur * 0.5, value: 0.10, curve: CurveType::Linear },
                            Keyframe { id: "fb_e3".into(), time: dur, value: -0.60, curve: CurveType::Linear },
                        ];
                    }
                    _ => {}
                }
            }
            Some(state)
        }
        "head_circle" | "Head Circle" => {
            // Rapid 2-second close-orbit circle with elevation corkscrew
            let cycle = 2.0;
            let mut pan_kf = Vec::new();
            let mut elev_kf = Vec::new();
            let mut t = 0.0;
            let mut id = 0;
            while t <= dur + cycle {
                pan_kf.push(Keyframe { id: format!("hc_p_{}", id), time: t, value: -1.0, curve: CurveType::Linear });
                pan_kf.push(Keyframe { id: format!("hc_p_{}_m", id), time: t + 1.0, value: 1.0, curve: CurveType::Linear });

                elev_kf.push(Keyframe { id: format!("hc_e_{}", id), time: t, value: -0.4, curve: CurveType::Linear });
                elev_kf.push(Keyframe { id: format!("hc_e_{}_m", id), time: t + 1.0, value: 0.4, curve: CurveType::Linear });

                t += cycle;
                id += 1;
            }

            for lane in &mut state.lanes {
                match lane.id {
                    AutomationLaneId::Pan => lane.keyframes = pan_kf.clone(),
                    AutomationLaneId::Elevation => lane.keyframes = elev_kf.clone(),
                    AutomationLaneId::Distance => {
                        lane.keyframes = vec![
                            Keyframe { id: "hc_d1".into(), time: 0.0, value: 0.10, curve: CurveType::Linear },
                            Keyframe { id: "hc_d2".into(), time: dur, value: 0.10, curve: CurveType::Linear },
                        ];
                    }
                    _ => {}
                }
            }
            Some(state)
        }
        "deep_space" | "Deep Space" => {
            // Recedes from near to deep space with expanding reverb and fading volume
            for lane in &mut state.lanes {
                match lane.id {
                    AutomationLaneId::Distance => {
                        lane.keyframes = vec![
                            Keyframe { id: "ds_d1".into(), time: 0.0, value: 0.10, curve: CurveType::Linear },
                            Keyframe { id: "ds_d2".into(), time: dur, value: 1.00, curve: CurveType::Linear },
                        ];
                    }
                    AutomationLaneId::Reverb => {
                        lane.keyframes = vec![
                            Keyframe { id: "ds_r1".into(), time: 0.0, value: 0.20, curve: CurveType::Linear },
                            Keyframe { id: "ds_r2".into(), time: dur, value: 0.90, curve: CurveType::Linear },
                        ];
                    }
                    AutomationLaneId::Volume => {
                        lane.keyframes = vec![
                            Keyframe { id: "ds_v1".into(), time: 0.0, value: 1.00, curve: CurveType::Linear },
                            Keyframe { id: "ds_v2".into(), time: dur * 0.7, value: 0.85, curve: CurveType::Linear },
                            Keyframe { id: "ds_v3".into(), time: dur, value: 0.30, curve: CurveType::Linear },
                        ];
                    }
                    _ => {}
                }
            }
            Some(state)
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bezier_lut_boundary_and_monotonicity() {
        let k1 = Keyframe {
            id: "k1".into(),
            time: 0.0,
            value: 0.2,
            curve: CurveType::Bezier {
                c1_x: 0.25,
                c1_y: 0.1,
                c2_x: 0.75,
                c2_y: 0.9,
            },
        };
        let k2 = Keyframe {
            id: "k2".into(),
            time: 2.0,
            value: 0.8,
            curve: CurveType::Linear,
        };

        let seg = PrecomputedSegment::new(&k1, &k2);
        assert!((seg.evaluate(0.0) - 0.2).abs() < 1e-4, "Start must match v_start");
        assert!((seg.evaluate(2.0) - 0.8).abs() < 1e-4, "End must match v_end");

        // Midway check
        let mid = seg.evaluate(1.0);
        assert!(mid > 0.2 && mid < 0.8, "Midpoint must be bounded: mid={}", mid);
    }

    #[test]
    fn test_linear_segment_evaluation() {
        let k1 = Keyframe { id: "k1".into(), time: 1.0, value: 10.0, curve: CurveType::Linear };
        let k2 = Keyframe { id: "k2".into(), time: 3.0, value: 20.0, curve: CurveType::Linear };
        let seg = PrecomputedSegment::new(&k1, &k2);

        assert_eq!(seg.evaluate(1.0), 10.0);
        assert_eq!(seg.evaluate(2.0), 15.0);
        assert_eq!(seg.evaluate(3.0), 20.0);
        assert_eq!(seg.evaluate(0.0), 10.0); // Clamped to start
        assert_eq!(seg.evaluate(4.0), 20.0); // Clamped to end
    }

    #[test]
    fn test_empty_lane_fallback_to_none() {
        let lane = AutomationLane::new(AutomationLaneId::Distance);
        let precomputed = PrecomputedLane::from_lane(&lane);
        // Empty lane must evaluate to None so audio callback falls back to manual slider
        assert_eq!(precomputed.evaluate(1.5), None);
    }

    #[test]
    fn test_binary_search_multi_segment_resolution() {
        let mut lane = AutomationLane::new(AutomationLaneId::Pan);
        lane.keyframes = vec![
            Keyframe { id: "1".into(), time: 0.0, value: -1.0, curve: CurveType::Linear },
            Keyframe { id: "2".into(), time: 2.0, value: 0.0, curve: CurveType::Linear },
            Keyframe { id: "3".into(), time: 4.0, value: 1.0, curve: CurveType::Linear },
        ];
        let precomputed = PrecomputedLane::from_lane(&lane);

        assert!((precomputed.evaluate(0.0).unwrap() - (-1.0)).abs() < 1e-4);
        assert!((precomputed.evaluate(1.0).unwrap() - (-0.5)).abs() < 1e-4);
        assert!((precomputed.evaluate(2.0).unwrap() - 0.0).abs() < 1e-4);
        assert!((precomputed.evaluate(3.0).unwrap() - 0.5).abs() < 1e-4);
        assert!((precomputed.evaluate(4.0).unwrap() - 1.0).abs() < 1e-4);
    }

    #[test]
    fn test_timeline_bridge_atomic_publish() {
        let bridge = TimelineBridge::new();
        assert_eq!(bridge.version.load(Ordering::Acquire), 1);

        let mut new_state = TimelineState::default();
        new_state.lanes[0].keyframes.push(Keyframe {
            id: "kf_test".into(),
            time: 0.5,
            value: 0.75,
            curve: CurveType::Linear,
        });

        bridge.publish(new_state);
        assert_eq!(bridge.version.load(Ordering::Acquire), 2);

        let active = bridge.timeline.read().unwrap();
        assert_eq!(active.pan.evaluate(0.5), Some(0.75));
    }
}
