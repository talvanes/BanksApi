import { assert } from "./deps.ts";
const encoder = new TextEncoder();
class CloseEvent extends Event {
    constructor(eventInit) {
        super("close", eventInit);
    }
}
export class ServerSentEvent extends Event {
    #data;
    #id;
    #type;
    constructor(type, data, { replacer, space, ...eventInit } = {}) {
        super(type, eventInit);
        this.#type = type;
        try {
            this.#data = typeof data === "string"
                ? data
                : JSON.stringify(data, replacer, space);
        }
        catch (e) {
            assert(e instanceof Error);
            throw new TypeError(`data could not be coerced into a serialized string.\n  ${e.message}`);
        }
        const { id } = eventInit;
        this.#id = id;
    }
    get data() {
        return this.#data;
    }
    get id() {
        return this.#id;
    }
    toString() {
        const data = `data: ${this.#data.split("\n").join("\ndata: ")}\n`;
        return `${this.#type === "__message" ? "" : `event: ${this.#type}\n`}${this.#id ? `id: ${String(this.#id)}\n` : ""}${data}\n`;
    }
}
const response = `HTTP/1.1 200 OK\n`;
const responseHeaders = new Headers([
    ["Connection", "Keep-Alive"],
    ["Content-Type", "text/event-stream"],
    ["Cache-Control", "no-cache"],
    ["Keep-Alive", `timeout=${Number.MAX_SAFE_INTEGER}`],
]);
export class ServerSentEventTarget extends EventTarget {
    #app;
    #closed = false;
    #prev = Promise.resolve();
    #ready;
    #serverRequest;
    #writer;
    #send = async (payload, prev) => {
        if (this.#closed) {
            return;
        }
        if (this.#ready !== true) {
            await this.#ready;
            this.#ready = true;
        }
        try {
            await prev;
            await this.#writer.write(encoder.encode(payload));
            await this.#writer.flush();
        }
        catch (error) {
            this.dispatchEvent(new CloseEvent({ cancelable: false }));
            const errorEvent = new ErrorEvent("error", { error });
            this.dispatchEvent(errorEvent);
            this.#app.dispatchEvent(errorEvent);
        }
    };
    #setup = async (overrideHeaders) => {
        const headers = new Headers(responseHeaders);
        if (overrideHeaders) {
            for (const [key, value] of overrideHeaders) {
                headers.set(key, value);
            }
        }
        let payload = response;
        for (const [key, value] of headers) {
            payload += `${key}: ${value}\n`;
        }
        payload += `\n`;
        try {
            await this.#writer.write(encoder.encode(payload));
            await this.#writer.flush();
        }
        catch (error) {
            this.dispatchEvent(new CloseEvent({ cancelable: false }));
            const errorEvent = new ErrorEvent("error", { error });
            this.dispatchEvent(errorEvent);
            this.#app.dispatchEvent(errorEvent);
            throw error;
        }
    };
    get closed() {
        return this.#closed;
    }
    constructor(app, serverRequest, { headers } = {}) {
        super();
        this.#app = app;
        this.#serverRequest = serverRequest;
        this.#writer = this.#serverRequest.w;
        this.addEventListener("close", () => {
            this.#closed = true;
            try {
                this.#serverRequest.conn.close();
            }
            catch (error) {
                if (!(error instanceof Deno.errors.BadResource)) {
                    const errorEvent = new ErrorEvent("error", { error });
                    this.dispatchEvent(errorEvent);
                    this.#app.dispatchEvent(errorEvent);
                }
            }
        });
        this.#ready = this.#setup(headers);
    }
    async close() {
        if (this.#ready !== true) {
            await this.#ready;
        }
        await this.#prev;
        this.dispatchEvent(new CloseEvent({ cancelable: false }));
    }
    dispatchComment(comment) {
        this.#prev = this.#send(`: ${comment.split("\n").join("\n: ")}\n\n`, this.#prev);
        return true;
    }
    dispatchMessage(data) {
        const event = new ServerSentEvent("__message", data);
        return this.dispatchEvent(event);
    }
    dispatchEvent(event) {
        const dispatched = super.dispatchEvent(event);
        if (dispatched && event instanceof ServerSentEvent) {
            this.#prev = this.#send(String(event), this.#prev);
        }
        return dispatched;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyX3NlbnRfZXZlbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXJ2ZXJfc2VudF9ldmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFHQSxPQUFPLEVBQUUsTUFBTSxFQUFhLE1BQU0sV0FBVyxDQUFDO0FBRzlDLE1BQU0sT0FBTyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7QUF5QmxDLE1BQU0sVUFBVyxTQUFRLEtBQUs7SUFDNUIsWUFBWSxTQUFvQjtRQUM5QixLQUFLLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzVCLENBQUM7Q0FDRjtBQUlELE1BQU0sT0FBTyxlQUFnQixTQUFRLEtBQUs7SUFDeEMsS0FBSyxDQUFTO0lBQ2QsR0FBRyxDQUFVO0lBQ2IsS0FBSyxDQUFTO0lBRWQsWUFDRSxJQUFZLEVBRVosSUFBUyxFQUNULEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLFNBQVMsS0FBMEIsRUFBRTtRQUUzRCxLQUFLLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLElBQUk7WUFDRixJQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sSUFBSSxLQUFLLFFBQVE7Z0JBQ25DLENBQUMsQ0FBQyxJQUFJO2dCQUNOLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUErQixFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ2xFO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixNQUFNLENBQUMsQ0FBQyxZQUFZLEtBQUssQ0FBQyxDQUFDO1lBQzNCLE1BQU0sSUFBSSxTQUFTLENBQ2pCLDBEQUEwRCxDQUFDLENBQUMsT0FBTyxFQUFFLENBQ3RFLENBQUM7U0FDSDtRQUNELE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxTQUFTLENBQUM7UUFDekIsSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUM7SUFDaEIsQ0FB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