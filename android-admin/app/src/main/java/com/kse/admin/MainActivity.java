package com.kse.admin;

import android.os.Bundle;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // ربط البطاقات (Cards) في الواجهة البرمجية
        CardView cardOrders = findViewById(R.id.card_orders);
        CardView cardProducts = findViewById(R.id.card_products);
        CardView cardMandoubs = findViewById(R.id.card_mandoubs);
        CardView cardSettings = findViewById(R.id.card_settings);

        // إضافة أحداث الضغط
        cardOrders.setOnClickListener(v -> Toast.makeText(this, "جاري فتح الطلبات الحقيقية...", Toast.LENGTH_SHORT).show());
        cardProducts.setOnClickListener(v -> Toast.makeText(this, "جاري فتح قائمة المنتجات...", Toast.LENGTH_SHORT).show());
        cardMandoubs.setOnClickListener(v -> Toast.makeText(this, "جاري فتح تتبع المناديب...", Toast.LENGTH_SHORT).show());
        cardSettings.setOnClickListener(v -> Toast.makeText(this, "جاري فتح إعدادات النظام...", Toast.LENGTH_SHORT).show());
    }
}
