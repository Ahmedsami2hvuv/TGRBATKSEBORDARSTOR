package com.kse.admin;

import com.google.gson.annotations.SerializedName;

public class Mandoub {
    @SerializedName("id")
    private String id;

    @SerializedName("name")
    private String name;

    @SerializedName("phone")
    private String phone;

    @SerializedName("lat")
    private double latitude;

    @SerializedName("lng")
    private double longitude;

    @SerializedName("status")
    private String status; // متصل، مشغول، غير متصل

    public String getId() { return id; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }
    public String getStatus() { return status; }
}
