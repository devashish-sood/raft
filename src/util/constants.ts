import { fail } from "assert";

export const Constants = Object.freeze({
  BROADCAST: "FFFF",
  GET: "get",
  PUT: "put",
  FOLLOWER: "follower",
  LEADER: "leader",
  CANDIDATE: "candidate",
  NOPULSE: "nopulse",
  PULSE: "pulse",
  OK: "ok",
  FAIL: "fail",
  APPENDENTRIES: "AE",
  VOTEREQUEST: "VREQ",
  VOTERESPONSE: "VRESP",
  REDIRECT: "redirect"
});
