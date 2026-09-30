"use client";

import React from "react";
import { FloatingAdminMenu } from "@/components/floating-admin-menu";

export default function FloatingMenuOverlayPage() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-transparent select-none">
      <FloatingAdminMenu />
    </div>
  );
}
