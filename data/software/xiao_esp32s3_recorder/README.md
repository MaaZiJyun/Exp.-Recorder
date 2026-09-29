# XIAO ESP32S3 Recorder

Firmware for the experiment-rig XIAO ESP32S3 Sense camera. It streams JPEG
frames over USB CDC for live preview and experiment recording.

## Target

- Board: Seeed Studio XIAO ESP32S3 Sense
- Arduino FQBN: `esp32:esp32:XIAO_ESP32S3`
- Source: `xiao_esp32s3_recorder.ino`

Compile and upload with Arduino CLI:

```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3 \
  --upload --port /dev/cu.usbmodemXXXX \
  data/software/xiao_esp32s3_recorder
```

Flashing replaces the program currently installed on the selected board.
