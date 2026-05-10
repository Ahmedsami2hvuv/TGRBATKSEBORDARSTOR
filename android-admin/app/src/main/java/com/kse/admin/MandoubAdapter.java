package com.kse.admin;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.util.List;

public class MandoubAdapter extends RecyclerView.Adapter<MandoubAdapter.MandoubViewHolder> {

    private List<Mandoub> mandoubs;

    public MandoubAdapter(List<Mandoub> mandoubs) {
        this.mandoubs = mandoubs;
    }

    @NonNull
    @Override
    public MandoubViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_mandoub, parent, false);
        return new MandoubViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull MandoubViewHolder holder, int position) {
        Mandoub mandoub = mandoubs.get(position);
        
        holder.tvName.setText(mandoub.getName());
        holder.tvPhone.setText(mandoub.getPhone());
        holder.tvStatus.setText(mandoub.getStatus());
        
        if ("متصل".equals(mandoub.getStatus())) {
            holder.tvStatus.setTextColor(Color.parseColor("#4CAF50"));
        } else if ("مشغول".equals(mandoub.getStatus())) {
            holder.tvStatus.setTextColor(Color.parseColor("#FF9800"));
        } else {
            holder.tvStatus.setTextColor(Color.parseColor("#9E9E9E"));
        }
    }

    @Override
    public int getItemCount() {
        return mandoubs.size();
    }

    static class MandoubViewHolder extends RecyclerView.ViewHolder {
        TextView tvName, tvPhone, tvStatus;

        public MandoubViewHolder(@NonNull View itemView) {
            super(itemView);
            tvName = itemView.findViewById(R.id.tv_mandoub_name);
            tvPhone = itemView.findViewById(R.id.tv_mandoub_phone);
            tvStatus = itemView.findViewById(R.id.tv_mandoub_status);
        }
    }
}
