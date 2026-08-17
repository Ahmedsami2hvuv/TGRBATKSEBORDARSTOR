"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function submitJobApplication(data: {
  name: string;
  region: string;
  phone: string;
  carType: string;
  hasAc: boolean;
  hasCommitment: boolean;
}) {
  try {
    const app = await prisma.jobApplication.create({
      data: {
        name: data.name,
        region: data.region,
        phone: data.phone,
        carType: data.carType,
        hasAc: data.hasAc,
        hasCommitment: data.hasCommitment,
        status: "pending"
      }
    });
    
    revalidatePath("/abo1stor3hlaa2kbr8-47/settings/job-applications");
    return { success: true, id: app.id };
  } catch (error) {
    console.error("Error submitting job application:", error);
    return { success: false, error: "Failed to submit application" };
  }
}
