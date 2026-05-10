package com.kse.admin;

import com.google.gson.annotations.SerializedName;

public class Product {
    @SerializedName("id")
    private String id;

    @SerializedName("name")
    private String name;

    @SerializedName("imageUrl")
    private String imageUrl;

    @SerializedName("sellPriceAlf")
    private double sellPriceAlf;

    public String getId() { return id; }
    public String getName() { return name; }
    public String getImageUrl() { return imageUrl; }
    public double getSellPriceAlf() { return sellPriceAlf; }
}
