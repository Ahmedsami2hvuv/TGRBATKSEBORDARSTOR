package com.kse.admin;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class LoginActivity extends AppCompatActivity {

    private EditText passwordInput;
    private Button loginButton;
    private static final String ADMIN_PASSWORD = "AHMEDHLAWAADAHAM";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        passwordInput = findViewById(R.id.password_input);
        loginButton = findViewById(R.id.login_button);

        loginButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String enteredPassword = passwordInput.getText().toString();
                if (enteredPassword.equals(ADMIN_PASSWORD)) {
                    // الانتقال للوحة التحكم
                    Intent intent = new Intent(LoginActivity.this, MainActivity.class);
                    startActivity(intent);
                    finish(); // إغلاق شاشة الدخول حتى لا يعود إليها عند الضغط على زر الرجوع
                } else {
                    Toast.makeText(LoginActivity.this, "كلمة السر خاطئة يا بطل!", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }
}
