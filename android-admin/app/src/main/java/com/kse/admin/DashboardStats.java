package com.kse.admin;

import com.google.gson.annotations.SerializedName;

public class DashboardStats {
    @SerializedName("todayOrdersCount")
    private int todayOrdersCount;

    @SerializedName("todaySalesTotal")
    private double todaySalesTotal;

    public int getTodayOrdersCount() { return todayOrdersCount; }
    public double getTodaySalesTotal() { return todaySalesTotal; }
}
