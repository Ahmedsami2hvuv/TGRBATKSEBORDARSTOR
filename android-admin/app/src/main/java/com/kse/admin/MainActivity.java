package com.kse.admin;

import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class MainActivity extends AppCompatActivity {

    private TextView tvTodayOrdersCount;
    private TextView tvTodaySalesTotal;
    private ApiService apiService;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // ربط البطاقات (Cards) في الواجهة البرمجية
        CardView cardOrders = findViewById(R.id.card_orders);
        CardView cardProducts = findViewById(R.id.card_products);
        CardView cardMandoubs = findViewById(R.id.card_mandoubs);
        CardView cardSettings = findViewById(R.id.card_settings);

        tvTodayOrdersCount = findViewById(R.id.tv_today_orders_count);
        tvTodaySalesTotal = findViewById(R.id.tv_today_sales_total);

        // إعداد Retrofit
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("https://kse-app.vercel.app/")
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        apiService = retrofit.create(ApiService.class);

        // جلب الإحصائيات
        fetchDashboardStats();

        // إضافة أحداث الضغط
        cardOrders.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, OrdersActivity.class);
            startActivity(intent);
        });

        cardProducts.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, ProductsActivity.class);
            startActivity(intent);
        });
        
        cardMandoubs.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, MandoubsActivity.class);
            startActivity(intent);
        });

        cardSettings.setOnClickListener(v -> Toast.makeText(this, "إعدادات النظام", Toast.LENGTH_SHORT).show());
    }

    private void fetchDashboardStats() {
        apiService.getDashboardStats().enqueue(new Callback<DashboardStats>() {
            @Override
            public void onResponse(Call<DashboardStats> call, Response<DashboardStats> response) {
                if (response.isSuccessful() && response.body() != null) {
                    DashboardStats stats = response.body();
                    tvTodayOrdersCount.setText(String.valueOf(stats.getTodayOrdersCount()));
                    tvTodaySalesTotal.setText(String.format("%,.0f د.ع", stats.getTodaySalesTotal()));
                }
            }

            @Override
            public void onFailure(Call<DashboardStats> call, Throwable t) {
                // هدوء، لا داعي لإظهار خطأ هنا لجعل تجربة المستخدم أسلس
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        // تحديث الإحصائيات عند الرجوع للواجهة الرئيسية
        fetchDashboardStats();
    }
}
