/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts on on-demand routes. Null when nobody is logged in. */
    session: import('./server/auth/server').AppSession | null;
  }
}
