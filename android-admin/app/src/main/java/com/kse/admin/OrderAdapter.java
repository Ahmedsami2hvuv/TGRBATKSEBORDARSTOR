package com.kse.admin;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.util.List;

public class OrderAdapter extends RecyclerView.Adapter<OrderAdapter.OrderViewHolder> {

    private List<Order> orders;

    public OrderAdapter(List<Order> orders) {
        this.orders = orders;
    }

    @NonNull
    @Override
    public OrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_order, parent, false);
        return new OrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderViewHolder holder, int position) {
        Order order = orders.get(position);
        
        holder.tvCustomerName.setText(order.getCustomerName());
        holder.tvRegionName.setText("المنطقة: " + order.getRegionName());
        holder.tvCustomerPhone.setText(order.getCustomerPhone());
        holder.tvOrderSummary.setText(order.getSummary());
        holder.tvTotalAmount.setText(String.format("%,.0f د.ع", order.getTotalAmount()));
        
        // تحسين عرض الحالة
        String statusText = order.getStatus();
        if ("pending".equals(statusText)) {
            holder.tvStatus.setText("بانتظار الموافقة");
            holder.tvStatus.setBackgroundResource(android.R.color.holo_orange_light);
        } else if ("submitted".equals(statusText)) {
            holder.tvStatus.setText("تم الإرسال");
            holder.tvStatus.setBackgroundResource(android.R.color.holo_blue_light);
        } else if ("draft".equals(statusText)) {
            holder.tvStatus.setText("قيد التجهيز");
            holder.tvStatus.setBackgroundResource(android.R.color.holo_green_light);
        } else {
            holder.tvStatus.setText(statusText);
        }
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class OrderViewHolder extends RecyclerView.ViewHolder {
        TextView tvCustomerName, tvRegionName, tvCustomerPhone, tvOrderSummary, tvTotalAmount, tvStatus;

        public OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            tvCustomerName = itemView.findViewById(R.id.tv_customer_name);
            tvRegionName = itemView.findViewById(R.id.tv_region_name);
            tvCustomerPhone = itemView.findViewById(R.id.tv_customer_phone);
            tvOrderSummary = itemView.findViewById(R.id.tv_order_summary);
            tvTotalAmount = itemView.findViewById(R.id.tv_total_amount);
            tvStatus = itemView.findViewById(R.id.tv_order_status);
        }
    }
}
