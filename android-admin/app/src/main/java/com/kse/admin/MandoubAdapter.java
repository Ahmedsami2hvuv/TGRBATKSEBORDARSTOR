package com.kse.admin;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.util.List;

public class MandoubAdapter extends RecyclerView.Adapter<MandoubAdapter.MandoubViewHolder> {

    private List<Mandoub> mandoubList;
    private Context context;

    public MandoubAdapter(List<Mandoub> mandoubList) {
        this.mandoubList = mandoubList;
    }

    @NonNull
    @Override
    public MandoubViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        context = parent.getContext();
        View view = LayoutInflater.from(context).inflate(R.layout.item_mandoub, parent, false);
        return new MandoubViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull MandoubViewHolder holder, int position) {
        Mandoub mandoub = mandoubList.get(position);
        holder.tvName.setText(mandoub.getName());
        holder.tvPhone.setText(mandoub.getPhone());

        // تغيير لون نقطة الحالة
        if ("متصل".equals(mandoub.getStatus())) {
            holder.ivStatus.setColorFilter(context.getResources().getColor(android.R.color.holo_green_light));
        } else {
            holder.ivStatus.setColorFilter(context.getResources().getColor(android.R.color.darker_gray));
        }

        // زر التتبع يفتح خرائط جوجل على موقع المندوب
        holder.btnTrack.setOnClickListener(v -> {
            if (mandoub.getLatitude() != 0 && mandoub.getLongitude() != 0) {
                String geoUri = "http://maps.google.com/maps?q=loc:" + mandoub.getLatitude() + "," + mandoub.getLongitude() + " (" + mandoub.getName() + ")";
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(geoUri));
                context.startActivity(intent);
            } else {
                android.widget.Toast.makeText(context, "موقع المندوب غير متوفر حالياً", android.widget.Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public int getItemCount() {
        return mandoubList.size();
    }

    public static class MandoubViewHolder extends RecyclerView.ViewHolder {
        TextView tvName, tvPhone;
        ImageView ivStatus;
        Button btnTrack;

        public MandoubViewHolder(@NonNull View itemView) {
            super(itemView);
            tvName = itemView.findViewById(R.id.tv_mandoub_name);
            tvPhone = itemView.findViewById(R.id.tv_mandoub_phone);
            ivStatus = itemView.findViewById(R.id.iv_mandoub_status);
            btnTrack = itemView.findViewById(R.id.btn_track);
        }
    }
}
