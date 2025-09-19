// import { connect, StringCodec, JSONCodec } from "nats";

// let nc: any = null;
// let js: any = null;
// const sc = StringCodec();

// async function getConnection() {
//   if (!nc) {
//     nc = await connect({
//       servers: process.env.NATS_URL || "nats://192.168.137.1:4222",
//     });
//     console.log(" Connected to NATS");
//     js = nc.jetstream();
//   }
//   return { nc, js };
// }

// export async function publishQuizSubmitted(payload: any) {
//   try {
//     const { js } = await getConnection();

//     console.log(" Publishing payload to JetStream...");
//     const data = sc.encode(JSON.stringify(payload));
//     const ack = await js.publish("quiz.submitted", data);

//     console.log(" Published to quiz.submitted", {
//       stream: ack.stream,
//       seq: ack.seq,
//     });
//   } catch (err) {
//     console.error(" Failed to publish quiz.submitted:", err);
//   }
// }
