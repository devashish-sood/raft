import { Command } from "commander";
import dgram from "dgram";
import { AddressInfo } from "net";

const BROADCAST = "FFFF";

type Replica = {
  targetPort: number;
  id: string;
  others: string[];
  socket: dgram.Socket;
};

const TEST_MESSAGE = { src: "me", dst: BROADCAST, leader: BROADCAST, type: "hello" };

interface ReplicaOptions {
  port: string;
  id: string;
  others: string[];
}

async function createReplica(port: number, id: string, others: string[]): Promise<Replica> {
  const socket = dgram.createSocket("udp4");
  await bindSocket(socket);
  return {
    targetPort: port,
    id: id,
    others: others,
    socket: socket,
  };
}

function sendMessage(replica: Replica, message: object): void {
  console.log("Sending message:", JSON.stringify(message));

  replica.socket.send(
    Buffer.from(JSON.stringify(message), "utf-8"),
    replica.targetPort,
    "127.0.0.1",
    (e) => {
      if (e) {
        console.error("Error on message transmission", e);
      }
    }
  );
}

function bindSocket(socket: dgram.Socket): Promise<void> {
  return new Promise((resolve) => {
    socket.bind({ address: "127.0.0.1", port: 0 });
    socket.once("listening", () => {
      const addressInfo = socket.address();
      console.log("Port assigned:", addressInfo);
      resolve();
    });
  });
}

function replicaEvents(replica: Replica): void {
  replica.socket.on("message", (msg, remoteInfo) => {
    console.log("Received message from:", remoteInfo.address);
    console.log(msg.toString("utf-8"));
  });
}

function setupArgs() {
  const program = new Command();
  program
    .argument("<port>", "Port number")
    .argument("<id>", "Replica ID")
    .argument("[others...]", "Other replica ids")
    .parse();

  const [port, id, ...others] = program.args;
  return {
    port: port ? Number(port) : 8000,
    id: id || "test",
    others: others || [],
  };
}
async function runReplica() {
  const argOptions = setupArgs();
  const replica = await createReplica(argOptions.port, argOptions.id, argOptions.others);
  replicaEvents(replica);
  sendMessage(replica, TEST_MESSAGE);
}

if (require.main === module) {
  runReplica();
}
