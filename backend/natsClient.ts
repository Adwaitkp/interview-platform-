import { connect, StringCodec, JSONCodec } from "nats";

let nc: any = null;
let js: any = null;
const sc = StringCodec();

async function getConnection() {
  if (!nc) {
    nc = await connect({
      servers: process.env.NATS_URL || "nats://10.149.185.246:4222",
    });
    console.log("✅ Connected to NATS");

    // JetStream context banao
    js = nc.jetstream();
  }
  return { nc, js };
}

export async function publishQuizSubmitted(payload: any) {
  try {
    const { js } = await getConnection();

    console.log(" Publishing payload to JetStream...");

    // JSON encode payload
    const data = sc.encode(JSON.stringify(payload));

    // JetStream me publish karo
    const ack = await js.publish("quiz.submitted", data);

    console.log(" Published to quiz.submitted", {
      stream: ack.stream,
      seq: ack.seq,
    });
  } catch (err) {
    console.error("❌ Failed to publish quiz.submitted:", err);
  }
}
