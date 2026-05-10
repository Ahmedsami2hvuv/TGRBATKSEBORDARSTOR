package com.kse.admin;

import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import java.util.ArrayList;
import java.util.List;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ProductsActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private ProductAdapter adapter;
    private List<Product> productList = new ArrayList<>();
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_products);

        recyclerView = findViewById(R.id.recycler_products);
        progressBar = findViewById(R.id.progress_bar_products);
        
        // عرض المنتجات بشكل شبكي (2 في كل صف) مثل الموقع
        recyclerView.setLayoutManager(new GridLayoutManager(this, 2));

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("https://kse-app.vercel.app/")
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        ApiService apiService = retrofit.create(ApiService.class);

        fetchProducts(apiService);
    }

    private void fetchProducts(ApiService apiService) {
        progressBar.setVisibility(View.VISIBLE);
        apiService.getProducts().enqueue(new Callback<List<Product>>() {
            @Override
            public void onResponse(Call<List<Product>> call, Response<List<Product>> response) {
                progressBar.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null) {
                    productList.clear();
                    productList.addAll(response.body());
                    adapter = new ProductAdapter(productList);
                    recyclerView.setAdapter(adapter);
                } else {
                    Toast.makeText(ProductsActivity.this, "فشل في جلب المنتجات", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<List<Product>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(ProductsActivity.this, "تأكد من الـ Push واتصال الإنترنت", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
