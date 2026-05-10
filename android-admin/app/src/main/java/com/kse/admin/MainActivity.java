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

        // ربط البطاقات الجديدة والقديمة
        CardView cardPending = findViewById(R.id.card_pending_orders);
        CardView cardPrep = findViewById(R.id.card_preparation);
        CardView cardOrders = findViewById(R.id.card_orders);
        CardView cardArchive = findViewById(R.id.card_archive);
        CardView cardProducts = findViewById(R.id.card_products);
        CardView cardMandoubs = findViewById(R.id.card_mandoubs);

        tvTodayOrdersCount = findViewById(R.id.tv_today_orders_count);
        tvTodaySalesTotal = findViewById(R.id.tv_today_sales_total);

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("https://kse-app.vercel.app/")
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        apiService = retrofit.create(ApiService.class);

        fetchDashboardStats();

        // 1. طلبات بانتظار الموافقة
        cardPending.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, OrdersActivity.class);
            intent.putExtra("STATUS", "pending");
            startActivity(intent);
        });

        // 2. قيد التجهيز (Drafts)
        cardPrep.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, OrdersActivity.class);
            intent.putExtra("STATUS", "drafts");
            startActivity(intent);
        });

        // 3. الطلبات المسندة (الجارية)
        cardOrders.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, OrdersActivity.class);
            intent.putExtra("STATUS", "submitted");
            startActivity(intent);
        });

        // 4. الأرشيف
        cardArchive.setOnClickListener(v -> {
            Intent intent = new Intent(MainActivity.this, OrdersActivity.class);
            intent.putExtra("STATUS", "archived");
            startActivity(intent);
        });

        // 5. المنتجات
        cardProducts.setOnClickListener(v -> {
            startActivity(new Intent(MainActivity.this, ProductsActivity.class));
        });
        
        // 6. المناديب
        cardMandoubs.setOnClickListener(v -> {
            startActivity(new Intent(MainActivity.this, MandoubsActivity.class));
        });
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
            public void onFailure(Call<DashboardStats> call, Throwable t) {}
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchDashboardStats();
    }
}
