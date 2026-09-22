# XIAO ESP32S3 库存体检固件

该固件只用于库存板体检，与实验台摄像 XIAO 固件相互独立。烧录会覆盖目标板当前程序。

## 依赖

- `arduino-cli`
- Arduino ESP32 core，包含 `esp32:esp32:XIAO_ESP32S3`
- Python `pyserial`

Web 界面会自动编译并烧录。也可以单独使用：

```bash
arduino-cli compile --fqbn esp32:esp32:XIAO_ESP32S3 \
  --upload --port /dev/cu.usbmodemXXXX \
  firmware/xiao_esp32s3_healthcheck
```

串口参数为 `115200 8N1`。支持命令：

- `HEALTH_INFO`：产品、eFuse MAC、Wi-Fi 与 Bluetooth 能力
- `HEALTH_HELLO`：运行并返回 `hello world`
- `HEALTH_GPIO`：D0 ↔ D1 数字回环
- `HEALTH_PWM`：D2 → D3 PWM 测量
- `HEALTH_UART`：D6/TX ↔ D7/RX 回环
- `HEALTH_SPI`：D10/MOSI → D9/MISO 回环
- `HEALTH_I2C`：扫描 D4/SDA、D5/SCL 上的外设

改变接线前必须先断电。XIAO 两侧是焊盘或排针位置，不一定有可直接插线的孔。I²C 测试需要把模块的 SDA、SCL、VCC、GND 分别连接至 XIAO 的 D4、D5、3V3、GND；没有模块或未焊排针时可以跳过，不能直接短接 D4 与 D5。
