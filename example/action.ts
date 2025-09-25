"use server";

import os from "node:os";

import { useRequest } from "@aet/server-actions";

export async function getData() {
  const req = useRequest();
  return {
    version: os.version(),
    userAgent: req.headers.get("User-Agent"),
  };
}

export const getOS = {
  async getVersion() {
    return os.version();
  },
};
