pub mod peaks;
pub mod reader;

pub use peaks::generate_waveform_peaks;
pub use reader::{decode_audio_file, DecodeError};
