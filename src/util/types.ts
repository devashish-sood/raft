import dgram, { RemoteInfo } from "dgram";

type Replica = {
  targetPort: number;
  id: string;
  others: string[];
  socket: dgram.Socket;
  leader: string;
};

interface ReplicaOptions {
  targetPort: number;
  id: string;
  others: string[];
}

type RaftStore = { [key: string]: string };

export { Replica, ReplicaOptions, RaftStore };
