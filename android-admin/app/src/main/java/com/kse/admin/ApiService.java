package com.kse.admin;

import java.util.List;
import retrofit2.Call;
import retrofit2.http.GET;
import retrofit2.http.Query;

public interface ApiService {
    // جلب الطلبات مع إمكانية التصفية حسب الحالة (pending, submitted, archived)
    @GET("api/admin/store/orders-history/list")
    Call<List<Order>> getOrders(@Query("status") String status, @Query("q") String query);

    // جلب المنتجات
    @GET("api/store/products?branchId=default")
    Call<List<Product>> getProducts();

    // جلب المناديب ومواقعهم
    @GET("api/admin/couriers/status")
    Call<List<Mandoub>> getMandoubs();

    // جلب إحصائيات لوحة التحكم
    @GET("api/admin/dashboard/stats")
    Call<DashboardStats> getDashboardStats();
}
