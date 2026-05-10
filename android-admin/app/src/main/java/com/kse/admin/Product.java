package com.kse.admin;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Product {
    @SerializedName("id")
    private String id;

    @SerializedName("name")
    private String name;

    @SerializedName("salePrice")
    private double salePrice;

    @SerializedName("description")
    private String description;

    @SerializedName("photoUrls")
    private List<String> photoUrls;

    public String getId() { return id; }
    public String getName() { return name; }
    public double getSalePrice() { return salePrice; }
    public String getDescription() { return description; }
    public List<String> getPhotoUrls() { return photoUrls; }
}
