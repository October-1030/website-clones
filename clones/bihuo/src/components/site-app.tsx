"use client";

import { useSyncExternalStore } from "react";
import { AuthApp } from "@/components/auth-app";
import { DashboardApp } from "@/components/dashboard-app";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function getRoute() { return window.location.hash || "#/dashboard"; }
function getServerRoute() { return "#/dashboard"; }

export function SiteApp() {
  const route = useSyncExternalStore(subscribe, getRoute, getServerRoute);
  return route.startsWith("#/auth/") ? <AuthApp /> : <DashboardApp route={route} />;
}
