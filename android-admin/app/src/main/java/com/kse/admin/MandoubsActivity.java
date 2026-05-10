package com.kse.admin;

import android.os.Bundle;
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

public class MandoubsActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private MandoubAdapter adapter;
    private List<Mandoub> mandoubList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mandoubs);

        recyclerView = findViewById(R.id.recycler_mandoubs);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));

        // إعداد الاتصال بالسيرفر
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("https://kse-app.vercel.app/")
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        ApiService apiService = retrofit.create(ApiService.class);

        // جلب بيانات المناديب
        apiService.getMandoubs().enqueue(new Callback<List<Mandoub>>() {
            @Override
            public void onResponse(Call<List<Mandoub>> call, Response<List<Mandoub>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    mandoubList.clear();
                    mandoubList.addAll(response.body());
                    adapter = new MandoubAdapter(mandoubList);
                    recyclerView.setAdapter(adapter);
                } else {
                    Toast.makeText(MandoubsActivity.this, "فشل في جلب قائمة المناديب", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<List<Mandoub>> call, Throwable t) {
                Toast.makeText(MandoubsActivity.this, "خطأ في الاتصال: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
