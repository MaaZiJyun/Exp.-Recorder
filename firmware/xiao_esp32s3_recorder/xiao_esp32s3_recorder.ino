/*
 * XIAO ESP32S3 Sense USB MJPEG Streamer
 *
 * The board does not need a microSD card. JPEG frames are sent over USB CDC;
 * the Exp.-Recorder Python service encodes them as a silent WebM file on the Mac.
 *
 * Commands:
 *   PING                    -> READY (only when the camera initialized)
 *   STATUS                  -> STATUS CAMERA,READY|ERROR
 *   CAPTURE                 -> one binary JPEG packet for idle live preview
 *   START_RECORD <VIDEO_ID> -> RECORDING, followed by binary JPEG packets
 *   STIM_MARK               -> STIM_ACK (between binary packets)
 *   STOP_RECORD             -> zero-length end packet, then SAVED <frame_count>
 *
 * Binary packet (little-endian):
 *   "EXPREC01" + uint32 jpeg_length + uint32 sequence + JPEG bytes
 * A jpeg_length of zero marks the end of the stream.
 */

#include "esp_camera.h"

#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     10
#define SIOD_GPIO_NUM     40
#define SIOC_GPIO_NUM     39
#define Y9_GPIO_NUM       48
#define Y8_GPIO_NUM       11
#define Y7_GPIO_NUM       12
#define Y6_GPIO_NUM       14
#define Y5_GPIO_NUM       16
#define Y4_GPIO_NUM       18
#define Y3_GPIO_NUM       17
#define Y2_GPIO_NUM       15
#define VSYNC_GPIO_NUM    38
#define HREF_GPIO_NUM     47
#define PCLK_GPIO_NUM     13

static const uint8_t STREAM_MAGIC[8] = {'E', 'X', 'P', 'R', 'E', 'C', '0', '1'};
static bool cameraReady = false;
static bool isStreaming = false;
static uint32_t frameSequence = 0;

void writeLittleEndian32(uint32_t value) {
  Serial.write((uint8_t)(value & 0xFF));
  Serial.write((uint8_t)((value >> 8) & 0xFF));
  Serial.write((uint8_t)((value >> 16) & 0xFF));
  Serial.write((uint8_t)((value >> 24) & 0xFF));
}

void writePacketHeader(uint32_t length, uint32_t sequence) {
  Serial.write(STREAM_MAGIC, sizeof(STREAM_MAGIC));
  writeLittleEndian32(length);
  writeLittleEndian32(sequence);
}

bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = psramFound() ? 14 : 18;
  config.fb_count = psramFound() ? 2 : 1;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  return esp_camera_init(&config) == ESP_OK;
}

void startStream() {
  if (isStreaming) {
    Serial.println("ERROR Stream already running");
    return;
  }
  if (!cameraReady) {
    Serial.println("ERROR Camera not ready");
    return;
  }
  frameSequence = 0;
  isStreaming = true;
  Serial.println("RECORDING");
}

void stopStream() {
  if (!isStreaming) {
    Serial.println("ERROR Stream is not running");
    return;
  }
  isStreaming = false;
  writePacketHeader(0, frameSequence);
  Serial.flush();
  Serial.print("SAVED ");
  Serial.println(frameSequence);
}

void streamFrame() {
  if (!isStreaming) return;
  camera_fb_t *frame = esp_camera_fb_get();
  if (!frame) {
    Serial.println("ERROR Camera frame capture failed");
    return;
  }
  writePacketHeader(frame->len, frameSequence);
  Serial.write(frame->buf, frame->len);
  frameSequence++;
  esp_camera_fb_return(frame);
}

void captureFrame() {
  if (isStreaming) {
    Serial.println("ERROR Stream already running");
    return;
  }
  if (!cameraReady) {
    Serial.println("ERROR Camera not ready");
    return;
  }
  camera_fb_t *frame = esp_camera_fb_get();
  if (!frame) {
    Serial.println("ERROR Camera frame capture failed");
    return;
  }
  writePacketHeader(frame->len, 0);
  Serial.write(frame->buf, frame->len);
  Serial.flush();
  esp_camera_fb_return(frame);
}

void processCommand(String command) {
  command.trim();
  if (command.length() == 0) return;
  if (command == "PING") {
    Serial.println(cameraReady ? "READY" : "ERROR Camera not ready");
  } else if (command == "STATUS") {
    Serial.print("STATUS CAMERA,");
    Serial.println(cameraReady ? "READY" : "ERROR");
  } else if (command.startsWith("START_RECORD")) {
    startStream();
  } else if (command == "CAPTURE") {
    captureFrame();
  } else if (command == "STIM_MARK") {
    Serial.println("STIM_ACK");
  } else if (command == "STOP_RECORD") {
    stopStream();
  } else {
    Serial.println("ERROR Unknown command");
  }
}

void setup() {
  Serial.begin(2000000);
  Serial.setTimeout(20);
  delay(1000);
  cameraReady = initCamera();
  Serial.println(cameraReady ? "READY" : "ERROR Camera init failed");
}

void loop() {
  while (Serial.available()) {
    processCommand(Serial.readStringUntil('\n'));
  }
  if (isStreaming) {
    streamFrame();
  } else {
    delay(2);
  }
}
