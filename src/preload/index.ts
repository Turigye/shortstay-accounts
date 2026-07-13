import { contextBridge } from "electron";

export type StayBooksApi = Readonly<Record<string, never>>;

const stayBooks: StayBooksApi = Object.freeze({});

contextBridge.exposeInMainWorld("stayBooks", stayBooks);
