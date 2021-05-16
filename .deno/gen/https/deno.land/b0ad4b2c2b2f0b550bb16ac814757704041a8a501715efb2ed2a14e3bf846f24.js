import { encode } from "../encoding/utf8.ts";
import { BufReader, BufWriter } from "../io/bufio.ts";
import { assert } from "../_util/assert.ts";
import { deferred, MuxAsyncIterator } from "../async/mod.ts";
import { bodyReader, chunkedBodyReader, emptyReader, readRequest, writeResponse, } from "./_io.ts";
export class ServerRequest {
    url;
    method;
    proto;
    protoMinor;
    protoMajor;
    headers;
    conn;
    r;
    w;
    #done = deferred();
    #contentLength = undefined;
    #body = undefined;
    #finalized = false;
    get done() {
        return this.#done.then((e) => e);
    }
    get contentLength() {
        if (this.#contentLength === undefined) {
            const cl = this.headers.get("content-length");
            if (cl) {
                this.#contentLength = parseInt(cl);
                if (Number.isNaN(this.#contentLength)) {
                    this.#contentLength = null;
                }
            }
            else {
                this.#contentLength = null;
            }
        }
        return this.#contentLength;
    }
    get body() {
        if (!this.#body) {
            if (this.contentLength != null) {
                this.#body = bodyReader(this.contentLength, this.r);
            }
            else {
                const transferEncoding = this.headers.get("transfer-encoding");
                if (transferEncoding != null) {
                    const parts = transferEncoding
                        .split(",")
                        .map((e) => e.trim().toLowerCase());
                    assert(parts.includes("chunked"), 'transfer-encoding must include "chunked" if content-length is not set');
                    this.#body = chunkedBodyReader(this.headers, this.r);
                }
                else {
                    this.#body = emptyReader();
                }
            }
        }
        return this.#body;
    }
    async respond(r) {
        let err;
        try {
            await writeResponse(this.w, r);
        }
        catch (e) {
            try {
                this.conn.close();
            }
            catch {
            }
            err = e;
        }
        this.#done.resolve(err);
        if (err) {
            throw err;
        }
    }
    async finalize() {
        if (this.#finalized)
            return;
        const body = this.body;
        const buf = new Uint8Array(1024);
        while ((await body.read(buf)) !== null) {
        }
        this.#finalized = true;
    }
}
export class Server {
    listener;
    #closing = false;
    #connections = [];
    constructor(listener) {
        this.listener = listener;
    }
    close() {
        this.#closing = true;
        this.listener.close();
        for (const conn of this.#connections) {
            try {
                conn.close();
            }
            catch (e) {
                if (!(e instanceof Deno.errors.BadResource)) {
                    throw e;
                }
            }
        }
    }
    async *iterateHttpRequests(conn) {
        const reader = new BufReader(conn);
        const writer = new BufWriter(conn);
        while (!this.#closing) {
            let request;
            try {
                request = await readRequest(conn, reader);
            }
            catch (error) {
                if (error instanceof Deno.errors.InvalidData ||
                    error instanceof Deno.errors.UnexpectedEof) {
                    try {
                        await writeResponse(writer, {
                            status: 400,
                            body: encode(`${error.message}\r\n\r\n`),
                        });
                    }
                    catch (error) {
                    }
                }
                break;
            }
            if (request === null) {
                break;
            }
            request.w = writer;
            yield request;
            const responseError = await request.done;
            if (responseError) {
                this.untrackConnection(request.conn);
                return;
            }
            try {
                await request.finalize();
            }
            catch (error) {
                break;
            }
        }
        this.untrackConnection(conn);
        try {
            conn.close();
        }
        catch (e) {
        }
    }
    trackConnection(conn) {
        this.#connections.push(conn);
    }
    untrackConnection(conn) {
        const index = this.#connections.indexOf(conn);
        if (index !== -1) {
            this.#connections.splice(index, 1);
        }
    }
    async *acceptConnAndIterateHttpRequests(mux) {
        if (this.#closing)
            return;
        let conn;
        try {
            conn = await this.listener.accept();
        }
        catch (error) {
            if (error instanceof Deno.errors.BadResource ||
                error instanceof Deno.errors.InvalidData ||
                error instanceof Deno.errors.UnexpectedEof ||
                error instanceof Deno.errors.ConnectionReset) {
                return mux.add(this.acceptConnAndIterateHttpRequests(mux));
            }
            throw error;
        }
        this.trackConnection(conn);
        mux.add(this.acceptConnAndIterateHttpRequests(mux));
        yield* this.iterateHttpRequests(conn);
    }
    [Symbol.asyncIterator]() {
        const mux = new MuxAsyncIterator();
        mux.add(this.acceptConnAndIterateHttpRequests(mux));
        return mux.iterate();
    }
}
export function _parseAddrFromStr(addr) {
    let url;
    try {
        const host = addr.startsWith(":") ? `0.0.0.0${addr}` : addr;
        url = new URL(`http://${host}`);
    }
    catch {
        throw new TypeError("Invalid address.");
    }
    if (url.username ||
        url.password ||
        url.pathname != "/" ||
        url.search ||
        url.hash) {
        throw new TypeError("Invalid address.");
    }
    return {
        hostname: url.hostname,
        port: url.port === "" ? 80 : Number(url.port),
    };
}
export function serve(addr) {
    if (typeof addr === "string") {
        addr = _parseAddrFromStr(addr);
    }
    const listener = Deno.listen(addr);
    return new Server(listener);
}
export async function listenAndServe(addr, handler) {
    const server = serve(addr);
    for await (const request of server) {
        handler(request);
    }
}
export function serveTLS(options) {
    const tlsOptions = {
        ...options,
        transport: "tcp",
    };
    const listener = Deno.listenTls(tlsOptions);
    return new Server(listener);
}
export async function listenAndServeTLS(options, handler) {
    const server = serveTLS(options);
    for await (const request of server) {
        handler(request);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUM3QyxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM1QyxPQUFPLEVBQVksUUFBUSxFQUFFLGdCQUFnQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDdkUsT0FBTyxFQUNMLFVBQVUsRUFDVixpQkFBaUIsRUFDakIsV0FBVyxFQUNYLFdBQVcsRUFDWCxhQUFhLEdBQ2QsTUFBTSxVQUFVLENBQUM7QUFFbEIsTUFBTSxPQUFPLGFBQWE7SUFDeEIsR0FBRyxDQUFVO0lBQ2IsTUFBTSxDQUFVO0lBQ2hCLEtBQUssQ0FBVTtJQUNmLFVBQVUsQ0FBVTtJQUNwQixVQUFVLENBQVU7SUFDcEIsT0FBTyxDQUFXO0lBQ2xCLElBQUksQ0FBYTtJQUNqQixDQUFDLENBQWE7SUFDZCxDQUFDLENBQWE7SUFFZCxLQUFLLEdBQWdDLFFBQVEsRUFBRSxDQUFDO0lBQ2hELGNBQWMsR0FBbUIsU0FBUyxDQUFDO0lBQzNDLEtBQUssR0FBaUIsU0FBUyxDQUFDO0lBQ2hDLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFFbkIsSUFBSSxJQUFJO1FBQ04sT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQU1ELElBQUksYUFBYTtRQUdmLElBQUksSUFBSSxDQUFDLGNBQWMsS0FBSyxTQUFTLEVBQUU7WUFDckMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUM5QyxJQUFJLEVBQUUsRUFBRTtnQkFD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