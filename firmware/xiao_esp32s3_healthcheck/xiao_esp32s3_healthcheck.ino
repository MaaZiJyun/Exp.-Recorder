/*
 * Exp. Recorder inventory health-check firmware for Seeed XIAO ESP32S3.
 *
 * This sketch is intentionally separate from the experiment camera firmware.
 * Uploading it replaces whatever firmware is currently on the inventory board.
 * Commands and replies are line-based so the Python checker can be reused by
 * the web API, a CLI, or a manufacturing fixture.
 */

#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <Wire.h>

static const int PIN_D0 = 1;
static const int PIN_D1 = 2;
static const int PIN_D2 = 3;
static const int PIN_D3 = 4;
static const int PIN_SDA = 5;
static const int PIN_SCL = 6;
static const int PIN_SCK = 7;
static const int PIN_MISO = 8;
static const int PIN_MOSI = 9;
static const int PIN_TX = 43;
static const int PIN_RX = 44;
static const char *FIRMWARE_ID = "XIAO_HEALTHCHECK_V3";
static const int DIGITAL_PINS[] = {
  PIN_D0, PIN_D1, PIN_D2, PIN_D3, PIN_SDA, PIN_SCL,
  PIN_TX, PIN_RX, PIN_SCK, PIN_MISO, PIN_MOSI
};

String hardwareMac() {
  uint64_t chipId = ESP.getEfuseMac();
  char value[13];
  snprintf(value, sizeof(value), "%04X%08X", (uint16_t)(chipId >> 32), (uint32_t)chipId);
  return String(value);
}

bool digitalLoopback(int first, int second) {
  pinMode(first, OUTPUT);
  pinMode(second, INPUT_PULLDOWN);
  digitalWrite(first, LOW);
  delay(5);
  bool lowOk = digitalRead(second) == LOW;
  digitalWrite(first, HIGH);
  delay(5);
  bool highOk = digitalRead(second) == HIGH;
  pinMode(first, INPUT_PULLDOWN);
  pinMode(second, OUTPUT);
  digitalWrite(second, HIGH);
  delay(5);
  bool reverseOk = digitalRead(first) == HIGH;
  pinMode(first, INPUT);
  pinMode(second, INPUT);
  return lowOk && highOk && reverseOk;
}

int gpioForLabel(String label) {
  label.trim();
  label.toUpperCase();
  if (!label.startsWith("D") || label.length() < 2) return -1;
  int index = label.substring(1).toInt();
  if (index < 0 || index > 10 || label != "D" + String(index)) return -1;
  return DIGITAL_PINS[index];
}

void testGpio(const String &firstLabel, const String &secondLabel) {
  int first = gpioForLabel(firstLabel);
  int second = gpioForLabel(secondLabel);
  if (first < 0 || second < 0 || first == second) {
    Serial.println("FAIL|GPIO|Choose two different pins from D0-D10");
    return;
  }
  if (digitalLoopback(first, second)) {
    Serial.printf("PASS|GPIO|%s-%s\n", firstLabel.c_str(), secondLabel.c_str());
  } else {
    Serial.printf("FAIL|GPIO|Check %s-%s jumper\n", firstLabel.c_str(), secondLabel.c_str());
  }
}

void testPwm() {
  pinMode(PIN_D3, INPUT);
  if (!ledcAttach(PIN_D2, 1000, 8)) {
    Serial.println("FAIL|PWM|Unable to attach PWM generator");
    return;
  }
  ledcWrite(PIN_D2, 128);
  unsigned long highTime = pulseIn(PIN_D3, HIGH, 50000);
  unsigned long lowTime = pulseIn(PIN_D3, LOW, 50000);
  ledcDetach(PIN_D2);
  pinMode(PIN_D2, INPUT);
  if (highTime > 200 && lowTime > 200) {
    Serial.printf("PASS|PWM|high=%luus,low=%luus\n", highTime, lowTime);
  } else {
    Serial.println("FAIL|PWM|Check D2-D3 jumper");
  }
}

void testUart() {
  // GPIO43/44 can contain a few transition bytes while UART1 is being
  // attached. Match a binary sequence instead of comparing the whole receive
  // buffer so startup noise cannot turn a valid loopback into a false failure.
  static const uint8_t token[] = {0x55, 0xAA, 0x31, 0xC7, 0x4D, 0x82, 0x19, 0xE0};
  Serial1.end();
  Serial1.begin(115200, SERIAL_8N1, PIN_RX, PIN_TX);
  delay(50);
  bool passed = false;
  for (int attempt = 0; attempt < 3 && !passed; attempt++) {
    while (Serial1.available()) Serial1.read();
    Serial1.write(token, sizeof(token));
    Serial1.flush();
    size_t matched = 0;
    unsigned long deadline = millis() + 200;
    while (millis() < deadline && matched < sizeof(token)) {
      if (!Serial1.available()) {
        delay(1);
        continue;
      }
      uint8_t value = (uint8_t)Serial1.read();
      matched = value == token[matched] ? matched + 1 : (value == token[0] ? 1 : 0);
    }
    passed = matched == sizeof(token);
  }
  Serial1.end();
  pinMode(PIN_TX, INPUT);
  pinMode(PIN_RX, INPUT);
  Serial.println(passed ? "PASS|UART|D6-TX to D7-RX" : "FAIL|UART|Check D6-D7 jumper");
}

void testSpi() {
  SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, -1);
  SPI.beginTransaction(SPISettings(100000, MSBFIRST, SPI_MODE0));
  uint8_t received = SPI.transfer(0xA5);
  SPI.endTransaction();
  SPI.end();
  Serial.println(received == 0xA5 ? "PASS|SPI|D10-MOSI to D9-MISO" : "FAIL|SPI|Check D10-D9 jumper");
}

void scanI2c() {
  Wire.begin(PIN_SDA, PIN_SCL);
  String addresses;
  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    if (Wire.endTransmission() == 0) {
      if (addresses.length()) addresses += ',';
      char value[5];
      snprintf(value, sizeof(value), "0x%02X", address);
      addresses += value;
    }
  }
  Wire.end();
  if (addresses.length()) Serial.println("PASS|I2C|" + addresses);
  else Serial.println("FAIL|I2C|No I2C module detected; connect module SDA to D4, SCL to D5, VCC to 3V3 and GND to GND, or skip this optional test");
}

void processCommand(String command) {
  command.trim();
  if (command == "HEALTH_INFO") {
    Serial.printf("PASS|INFO|XIAO ESP32S3|%s|WIFI=1|BLUETOOTH=1\n", hardwareMac().c_str());
  } else if (command == "HEALTH_HELLO") {
    Serial.println("PASS|HELLO|hello world");
  } else if (command == "HEALTH_GPIO") {
    testGpio("D0", "D1");
  } else if (command.startsWith("HEALTH_GPIO ")) {
    String arguments = command.substring(strlen("HEALTH_GPIO "));
    int separator = arguments.indexOf(' ');
    if (separator < 1) {
      Serial.println("FAIL|GPIO|Expected HEALTH_GPIO D0 D1");
    } else {
      String firstLabel = arguments.substring(0, separator);
      String secondLabel = arguments.substring(separator + 1);
      firstLabel.trim();
      secondLabel.trim();
      firstLabel.toUpperCase();
      secondLabel.toUpperCase();
      testGpio(firstLabel, secondLabel);
    }
  } else if (command == "HEALTH_PWM") {
    testPwm();
  } else if (command == "HEALTH_UART") {
    testUart();
  } else if (command == "HEALTH_SPI") {
    testSpi();
  } else if (command == "HEALTH_I2C") {
    scanI2c();
  } else if (command == "PING") {
    Serial.printf("PASS|PING|%s\n", FIRMWARE_ID);
  } else if (command.length()) {
    Serial.println("FAIL|COMMAND|Unknown command");
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(50);
  delay(500);
  Serial.printf("PASS|READY|%s\n", FIRMWARE_ID);
}

void loop() {
  if (Serial.available()) processCommand(Serial.readStringUntil('\n'));
  delay(2);
}
