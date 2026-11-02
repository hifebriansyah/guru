// One page: the home page, and the address of a question (/apa-surga-itu-ada) which is the same page with that question opened.
// Anything deeper goes back to the home page.
import { type RouteConfig, route } from "@react-router/dev/routes";

export default [route(":slug?", "routes/home.tsx"), route("*", "routes/not-found.tsx")] satisfies RouteConfig;
