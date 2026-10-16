use std::fs::File;
use std::path::Path;
use thiserror::Error;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::{FormatOptions, Track};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use crate::models::AudioBuffer;

#[derive(Error, Debug)]
pub enum DecodeError {
    #[error("Failed to open audio file: {0}")]
    Io(#[from] std::io::Error),

    #[error("Unrecognized audio format for file '{0}'")]
    FormatNotFound(String),

    #[error("No supported audio tracks found in file")]
    NoSupportedTrack,

    #[error("Decoder initialization failed: {0}")]
    DecoderInit(String),

    #[error("Error decoding audio stream: {0}")]
    Decoding(String),

    #[error("File contains no playable audio data")]
    EmptyStream,
}

/// Decodes an audio file (MP3, WAV, FLAC, etc.) into an interleaved stereo 32-bit float AudioBuffer.
///
/// Inputs:
/// - `path`: Filesystem path to audio file.
///
/// Outputs:
/// - `Ok((AudioBuffer, String))`: Interleaved stereo AudioBuffer and format name description.
/// - `Err(DecodeError)`: Descriptive error on file I/O or decode failure.
///
/// Invariants:
/// - The resulting `AudioBuffer` is strictly interleaved stereo: `[L0, R0, L1, R1, ...]`.
/// - `channels` is always 2.
/// - `samples.len() % 2 == 0`.
/// - Mono tracks are duplicated to both channels; surround formats extract front Left & Right.
pub fn decode_audio_file<P: AsRef<Path>>(path: P) -> Result<(AudioBuffer, String), DecodeError> {
    let path_ref = path.as_ref();
    let file = File::open(path_ref)?;
    let file_name = path_ref
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "audio".to_string());

    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path_ref.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts: FormatOptions = Default::default();
    let metadata_opts: MetadataOptions = Default::default();
    let decoder_opts: DecoderOptions = Default::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|_| DecodeError::FormatNotFound(file_name))?;

    let mut format = probed.format;

    let track: &Track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or(DecodeError::NoSupportedTrack)?;

    let track_id = track.id;
    let codec_params = track.codec_params.clone();

    let sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| DecodeError::Decoding("Missing sample rate in stream".to_string()))?;

    let format_desc = format!("{codec_params:?}");
    let mut decoder = symphonia::default::get_codecs()
        .make(&codec_params, &decoder_opts)
        .map_err(|e| DecodeError::DecoderInit(e.to_string()))?;

    let mut interleaved_samples: Vec<f32> = Vec::new();
    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymphoniaError::IoError(ref err)) if err.kind() == std::io::ErrorKind::UnexpectedEof => {
                break;
            }
            Err(SymphoniaError::ResetRequired) => continue,
            Err(SymphoniaError::IoError(_)) => break,
            Err(e) => return Err(DecodeError::Decoding(e.to_string())),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();

                if sample_buf.is_none() {
                    sample_buf = Some(SampleBuffer::<f32>::new(decoded.capacity() as u64, spec));
                }

                if let Some(buf) = sample_buf.as_mut() {
                    buf.copy_interleaved_ref(decoded);
                    let raw_samples = buf.samples();
                    let channels = spec.channels.count();

                    if channels == 1 {
                        // Mono: duplicate to L and R
                        for &s in raw_samples {
                            interleaved_samples.push(s);
                            interleaved_samples.push(s);
                        }
                    } else if channels == 2 {
                        // Stereo: copy interleaved samples directly
                        interleaved_samples.extend_from_slice(raw_samples);
                    } else if channels > 2 {
                        // Surround: extract Front Left (0) and Front Right (1)
                        for chunk in raw_samples.chunks_exact(channels) {
                            interleaved_samples.push(chunk[0]);
                            interleaved_samples.push(chunk[1]);
                        }
                    }
                }
            }
            Err(SymphoniaError::IoError(ref err)) if err.kind() == std::io::ErrorKind::UnexpectedEof => {
                break;
            }
            Err(SymphoniaError::DecodeError(_)) => {
                // Skip corrupted frame and continue stream
                continue;
            }
            Err(e) => return Err(DecodeError::Decoding(e.to_string())),
        }
    }

    let total_frames = interleaved_samples.len() / 2;
    if total_frames == 0 {
        return Err(DecodeError::EmptyStream);
    }

    let duration = total_frames as f64 / sample_rate as f64;

    // Self-check postconditions
    debug_assert_eq!(interleaved_samples.len() % 2, 0);

    let audio_buffer = AudioBuffer::new(interleaved_samples, sample_rate, 2, duration);
    Ok((audio_buffer, format_desc))
}
