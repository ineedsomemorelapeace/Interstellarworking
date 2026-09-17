// The tabs page owns the proxy service worker registration.
// Do not register a separate /a/ worker here; a more-specific /a/ scope
// can override the root worker and break proxied navigation.
