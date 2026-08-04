# Default BGM

The original Storybound client ships a `default-bgm.mp3`, but its redistribution license has not been verified. The binary is therefore intentionally excluded from this public repository.

For a local installation that you are authorized to use, either place the file at:

`public/audio/default-bgm.mp3`

or set:

`STORYBOUND_DEFAULT_BGM_PATH=C:\absolute\path\to\default-bgm.mp3`

The server also detects the locally unpacked original-client resources used by the repository's reverse-engineering workspace. API keys and other credentials are never read from this directory.
