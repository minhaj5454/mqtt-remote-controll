const mqtt = require('mqtt');

const options = {
  keepalive: 60,         // Har 60 seconds mein ping
  protocolVersion: 5     // MQTT version 5 ka use
};
// Yeh broker wahi hai jo server use kar raha hai
// const client = mqtt.connect('mqtt://test.mosquitto.org', options);
const client = mqtt.connect('mqtt://test.mosquitto.org');

// Unique deviceId define karo
const deviceId = 'device123';

// Global interval variable, jisse hum start/stop manage karenge
let intervalId = null;

// Function to start publishing sensor data
function startPublishing() {
  // Agar already publishing ho raha hai, toh dobara start na karein
  if (intervalId !== null) return;
  
  intervalId = setInterval(() => {
    // Sensor data simulate kar rahe hain
    let temp = 20 + Math.random() * 10;
    temp = Math.ceil(temp); // Math.ceil se round up
    
    let humidity = 40 + Math.random() * 20;
    humidity = Math.ceil(humidity);

    const sensorData = {
      temperature: temp,
      humidity: humidity
    };

    // Topic jahan device sensor data bhej raha hai
    const topic = `device/${deviceId}/to/server`;
    const payload = JSON.stringify(sensorData);

    client.publish(topic, payload, { qos: 2 }, (err) => {
      if (err) {
        console.error(`❌ Error publishing message from [${deviceId}]:`, err);
      } else {
        console.log(`📤 IoT Device [${deviceId}] published:`, sensorData);
      }
    });
  }, 5000);
}

client.on('connect', () => {
  console.log(`✅ IoT Device [${deviceId}] connected to MQTT broker`);

  // Subscribe karo control topic ke liye jahan server se command aayegi
  const controlTopic = `server/to/device/${deviceId}/control`;
  client.subscribe(controlTopic, { qos: 2 },(err) => {
    if (err) {
      console.error(`❌ Error subscribing to control topic:`, err);
    } else {
      console.log(`📩 Subscribed to control topic: ${controlTopic}`);
    }
  });

  // Start publishing sensor data initially
  startPublishing();

  // Control messages ke liye listener
  client.on('message', (topic, message) => {
    if (topic === controlTopic) {
      try {
        const controlMsg = JSON.parse(message.toString().trim());
        if (controlMsg.command === 'stop') {
          console.warn(`⚠️ Received stop command from server. Stopping further messages.`);
          clearInterval(intervalId);
          intervalId = null; // Reset intervalId to allow restart
        } else if (controlMsg.command === 'start') {
          console.log(`✅ Received start command from server. Resuming messages.`);
          startPublishing();
        }
      } catch (err) {
        console.error(`❌ Error parsing control message:`, err);
      }
    }
  });
});

client.on('error', (error) => {
  console.error(`❌ IoT Device [${deviceId}] encountered an error:`, error);
});
