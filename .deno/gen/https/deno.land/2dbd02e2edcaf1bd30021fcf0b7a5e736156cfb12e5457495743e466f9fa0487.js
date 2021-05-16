import { Context } from "./context.ts";
import { serve as defaultServe, serveTLS as defaultServeTls, STATUS_TEXT, } from "./deps.ts";
import { KeyStack } from "./keyStack.ts";
import { compose } from "./middleware.ts";
function isOptionsTls(options) {
    return options.secure === true;
}
const ADDR_REGEXP = /^\[?([^\]]*)\]?:([0-9]{1,5})$/;
export class ApplicationErrorEvent extends ErrorEvent {
    context;
    constructor(eventInitDict) {
        super("error", eventInitDict);
        this.context = eventInitDict.context;
    }
}
export class ApplicationListenEvent extends Event {
    hostname;
    port;
    secure;
    constructor(eventInitDict) {
        super("listen", eventInitDict);
        this.hostname = eventInitDict.hostname;
        this.port = eventInitDict.port;
        this.secure = eventInitDict.secure;
    }
}
export class Application extends EventTarget {
    #composedMiddleware;
    #keys;
    #middleware = [];
    #serve;
    #serveTls;
    get keys() {
        return this.#keys;
    }
    set keys(keys) {
        if (!keys) {
            this.#keys = undefined;
            return;
        }
        else if (Array.isArray(keys)) {
            this.#keys = new KeyStack(keys);
        }
        else {
            this.#keys = keys;
        }
    }
    proxy;
    state;
    constructor(options = {}) {
        super();
        const { state, keys, proxy, serve = defaultServe, serveTls = defaultServeTls, } = options;
        this.proxy = proxy ?? false;
        this.keys = keys;
        this.state = state ?? {};
        this.#serve = serve;
        this.#serveTls = serveTls;
    }
    #getComposed = () => {
        if (!this.#composedMiddleware) {
            this.#composedMiddleware = compose(this.#middleware);
        }
        return this.#composedMiddleware;
    };
    #handleError = (context, error) => {
        if (!(error instanceof Error)) {
            error = new Error(`non-error thrown: ${JSON.stringify(error)}`);
        }
        const { message } = error;
        this.dispatchEvent(new ApplicationErrorEvent({ context, message, error }));
        if (!context.response.writable) {
            return;
        }
        for (const key of context.response.headers.keys()) {
            context.response.headers.delete(key);
        }
        if (error.headers && error.headers instanceof Headers) {
            for (const [key, value] of error.headers) {
                context.response.headers.set(key, value);
            }
        }
        context.response.type = "text";
        const status = context.response.status =
            error instanceof Deno.errors.NotFound
                ? 404
                : error.status && typeof error.status === "number"
                    ? error.status
                    : 500;
        context.response.body = error.expose
            ? error.message
            : STATUS_TEXT.get(status);
    };
    #handleRequest = async (request, secure, state) => {
        const context = new Context(this, request, secure);
        let resolve;
        const handlingPromise = new Promise((res) => resolve = res);
        state.handling.add(handlingPromise);
        if (!state.closing && !state.closed) {
            try {
                await this.#getComposed()(context);
            }
            catch (err) {
                this.#handleError(context, err);
            }
        }
        if (context.respond === false) {
            context.response.destroy();
            resolve();
            state.handling.delete(handlingPromise);
            return;
        }
        try {
            await request.respond(await context.response.toServerResponse());
            if (state.closing) {
                state.server.close();
                state.closed = true;
            }
        }
        catch (err) {
            this.#handleError(context, err);
        }
        finally {
            context.response.destroy();
            resolve();
            state.handling.delete(handlingPromise);
        }
    };
    addEventListener(type, listener, options) {
        super.addEventListener(type, listener, options);
    }
    handle = async (request, secure = false) => {
        if (!this.#middleware.length) {
            throw new TypeError("There is no middleware to process requests.");
        }
        const context = new Context(this, request, secure);
        try {
            await this.#getComposed()(context);
        }
        catch (err) {
            this.#handleError(context, err);
        }
        if (context.respond === false) {
            context.response.destroy();
            return;
        }
        try {
            const response = await context.response.toServerResponse();
            context.response.destroy();
            return response;
        }
        catch (err) {
            this.#handleError(context, err);
            throw err;
        }
    };
    async listen(options) {
        if (!this.#middleware.length) {
            throw new TypeError("There is no middleware to process requests.");
        }
        if (typeof options === "string") {
            const match = ADDR_REGEXP.exec(options);
            if (!match) {
                throw TypeError(`Invalid address passed: "${options}"`);
            }
            const [, hostname, portStr] = match;
            options = { hostname, port: parseInt(portStr, 10) };
        }
        const server = isOptionsTls(options)
            ? this.#serveTls(options)
            : this.#serve(options);
        const { signal } = options;
        const state = {
            closed: false,
            closing: false,
            handling: new Set(),
            server,
        };
        if (signal) {
            signal.addEventListener("abort", () => {
                if (!state.handling.size) {
                    server.close();
                    state.closed = true;
                }
                state.closing = true;
            });
        }
        const { hostname, port, secure = false } = options;
        this.dispatchEvent(new ApplicationListenEvent({ hostname, port, secure }));
        try {
            for await (const request of server) {
                this.#handleRequest(request, secure, state);
            }
            await Promise.all(state.handling);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : "Application Error";
            this.dispatchEvent(new ApplicationErrorEvent({ message, error }));
        }
    }
    use(...middleware) {
        this.#middleware.push(...middleware);
        this.#composedMiddleware = undefined;
        return this;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcHBsaWNhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3ZDLE9BQU8sRUFDTCxLQUFLLElBQUksWUFBWSxFQUNyQixRQUFRLElBQUksZUFBZSxFQUUzQixXQUFXLEdBQ1osTUFBTSxXQUFXLENBQUM7QUFDbkIsT0FBTyxFQUFPLFFBQVEsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUM5QyxPQUFPLEVBQUUsT0FBTyxFQUFjLE1BQU0saUJBQWlCLENBQUM7QUEyQnRELFNBQVMsWUFBWSxDQUFDLE9BQXNCO0lBQzFDLE9BQU8sT0FBTyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUM7QUFDakMsQ0FBQztBQXVFRCxNQUFNLFdBQVcsR0FBRywrQkFBK0IsQ0FBQztBQUVwRCxNQUFNLE9BQU8scUJBQXVDLFNBQVEsVUFBVTtJQUNwRSxPQUFPLENBQWM7SUFFckIsWUFBWSxhQUEyQztRQUNyRCxLQUFLLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztJQUN2QyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sc0JBQXVCLFNBQVEsS0FBSztJQUMvQyxRQUFRLENBQVU7SUFDbEIsSUFBSSxDQUFTO0lBQ2IsTUFBTSxDQUFVO0lBRWhCLFlBQVksYUFBeUM7UUFDbkQsS0FBSyxDQUFDLFFBQVEsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsUUFBUSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUM7UUFDdkMsSUFBSSxDQUFDLElBQUksR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDO1FBQy9CLElBQUksQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQztJQUNyQyxDQUFDO0NBQ0Y7QUFTRCxNQUFNLE9BQU8s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