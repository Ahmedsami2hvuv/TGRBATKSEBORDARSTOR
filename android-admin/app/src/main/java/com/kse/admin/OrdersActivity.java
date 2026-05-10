package com.kse.admin;

import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import java.util.ArrayList;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class OrdersActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private OrderAdapter adapter;
    private List<Order> orderList = new ArrayList<>();
    private ProgressBar progressBar;
    private TextView tvTitle;
    private String status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_orders);

        recyclerView = findViewById(R.id.recycler_orders);
        progressBar = findViewById(R.id.progress_bar);
        tvTitle = findViewById(R.id.tv_orders_title);
        
        recyclerView.setLayoutManager(new LinearLayoutManager(this));

        // استقبال نوع القسم المطلوب (pending, submitted, archived, drafts)
        status = getIntent().getStringExtra("STATUS");
        if (status == null) status = "all";

        updateTitle(status);

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("https://kse-app.vercel.app/")
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        ApiService apiService = retrofit.create(ApiService.class);

        fetchOrders(apiService);
    }

    private void updateTitle(String status) {
        switch (status) {
            case "pending": tvTitle.setText("طلبات بانتظار الموافقة"); break;
            case "submitted": tvTitle.setText("الطلبات المسندة"); break;
            case "archived": tvTitle.setText("أرشيف الطلبات"); break;
            case "drafts": tvTitle.setText("قيد التجهيز (مسودات)"); break;
            default: tvTitle.setText("كافة الطلبات");
        }
    }

    private void fetchOrders(ApiService apiService) {
        progressBar.setVisibility(View.VISIBLE);
        
        Call<List<Order>> call;
        if ("drafts".equals(status)) {
            call = apiService.getDrafts();
        } else {
            call = apiService.getOrders(status, "");
        }

        call.enqueue(new Callback<List<Order>>() {
            @Override
            public void onResponse(Call<List<Order>> call, Response<List<Order>> response) {
                progressBar.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null) {
                    orderList.clear();
                    orderList.addAll(response.body());
                    adapter = new OrderAdapter(orderList);
                    recyclerView.setAdapter(adapter);
                    
                    if (orderList.isEmpty()) {
                        Toast.makeText(OrdersActivity.this, "لا توجد بيانات في هذا القسم حالياً", Toast.LENGTH_SHORT).show();
                    }
                } else {
                    Toast.makeText(OrdersActivity.this, "فشل في جلب البيانات من الموقع", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<List<Order>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(OrdersActivity.this, "تأكد من عمل Push للموقع أولاً واتصال الإنترنت", Toast.LENGTH_LONG).show();
            }
        });
    }
}
