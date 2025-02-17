const mqtt = require('mqtt');
const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

// ✅ MongoDB se connect ho rahe hain
mongoose.connect('mongodb://localhost:27017/mqtt_messages_remote_controll')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Mongoose Schema aur Model define kar rahe hain
const messageSchema = new mongoose.Schema({
  deviceId: String,
  topic: String,
  payload: mongoose.Schema.Types.Mixed, // Kisi bhi tarah ka JSON data store karne ke liye
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// ✅ MQTT broker se connect ho rahe hain
const client = mqtt.connect('mqtt://test.mosquitto.org');

client.on('connect', () => {
  console.log("✅ Connected to MQTT broker");

  // Device messages ke liye topics subscribe kar rahe hain
  client.subscribe('device/+/to/server', { qos: 2 },(err) => {
    if (!err) {
      console.log("📩 Subscribed to topic: device/+/to/server");
    }
  });

  client.subscribe('device/+/to/server2',{ qos: 2 }, (err) => {
    if (!err) {
      console.log("📩 Subscribed to topic: device/+/to/server2");
    }
  });
});

// ✅ MQTT se aane wale messages ko process karke MongoDB me store kar rahe hain
client.on('message', (topic, message) => {
  const topicParts = topic.split('/');  // Example: ['device', 'device123', 'to', 'server']
  const deviceId = topicParts[1];         // 'device123'

  try {
    const msg = JSON.parse(message.toString().trim());
    console.log(`📥 Received from [${deviceId}]:`, msg);

    // MongoDB me message save kar rahe hain
    const msgDoc = new Message({ deviceId, topic, payload: msg });
    msgDoc.save()
      .then(() => console.log(`💾 Message saved for device [${deviceId}]`))
      .catch(err => console.error(`❌ Error saving message for device [${deviceId}]:`, err));

  } catch (error) {
    console.log(`❌ JSON Parse Error from [${deviceId}]:`, message.toString());
  }
});

// ✅ Naya POST endpoint for control commands from mobile 
app.post('/control', (req, res) => {
  const { deviceId, command } = req.body;
  if (!deviceId || !command) {
    return res.status(400).json({ error: 'deviceId and command are required' });
  }
  
  // Control topic jahan device command receive karega
  const controlTopic = `server/to/device/${deviceId}/control`;
  const payload = JSON.stringify({ command });
  
  client.publish(controlTopic, payload, { qos: 2 }, (err) => {
    if (err) {
      console.error(`❌ Error sending control command to device [${deviceId}]:`, err);
      return res.status(500).json({ error: 'Failed to send control command' });
    }
    console.log(`📤 Control command sent to device [${deviceId}]:`, { command });
    res.json({ success: true, message: `Control command sent to device [${deviceId}]` });
  });
});

// ✅ Existing POST endpoint for sending regular MQTT messages
app.post('/send', (req, res) => {
  const { message, deviceId } = req.body;  
  if (!message || !deviceId) {
    return res.status(400).json({ error: 'Message & deviceId are required' });
  }

  const topic = `server/to/device/${deviceId}`;
  const payload = JSON.stringify(message);

  client.publish(topic, payload, { qos: 2 });

  console.log(`📤 Sent to [${deviceId}]:`, message);
  res.json({ success: true, message: `Sent to [${deviceId}]: ${JSON.stringify(message)}` });
});

// ✅ API Server Start
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
