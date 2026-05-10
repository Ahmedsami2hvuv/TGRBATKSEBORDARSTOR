package com.kse.admin;

import com.google.gson.annotations.SerializedName;

public class Order {
    @SerializedName("id")
    private String id;
    
    @SerializedName("customerName")
    private String customerName;
    
    @SerializedName("customerPhone")
    private String customerPhone;
    
    @SerializedName("totalAmount")
    private double totalAmount;
    
    @SerializedName("status")
    private String status;

    @SerializedName("summary")
    private String summary;

    @SerializedName("regionName")
    private String regionName;

    @SerializedName("date")
    private String date;

    public String getId() { return id; }
    public String getCustomerName() { return customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public double getTotalAmount() { return totalAmount; }
    public String getStatus() { return status; }
    public String getSummary() { return summary; }
    public String getRegionName() { return regionName; }
    public String getDate() { return date; }
}
