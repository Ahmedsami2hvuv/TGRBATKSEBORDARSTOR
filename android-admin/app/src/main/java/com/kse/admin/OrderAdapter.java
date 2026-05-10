package com.kse.admin;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.util.List;

public class OrderAdapter extends RecyclerView.Adapter<OrderAdapter.OrderViewHolder> {

    private List<Order> orderList;
    private Context context;

    public OrderAdapter(List<Order> orderList) {
        this.orderList = orderList;
    }

    @NonNull
    @Override
    public OrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        context = parent.getContext();
        View view = LayoutInflater.from(context).inflate(R.layout.item_order, parent, false);
        return new OrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderViewHolder holder, int position) {
        Order order = orderList.get(position);
        holder.tvOrderId.setText("طلب #" + order.getId());
        holder.tvCustomerName.setText("الزبون: " + order.getCustomerName());
        holder.tvOrderTotal.setText("المبلغ: " + order.getTotalAmount() + " د.ع");
        holder.tvStatus.setText(order.getStatus());

        // برمجة زر الواتساب
        holder.btnWhatsapp.setOnClickListener(v -> {
            String phone = order.getCustomerPhone();
            if (phone != null && !phone.isEmpty()) {
                try {
                    // تحضير رابط واتساب
                    String url = "https://api.whatsapp.com/send?phone=" + phone + "&text=" + 
                                 Uri.encode("السلام عليكم، بخصوص طلبك رقم #" + order.getId());
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setData(Uri.parse(url));
                    context.startActivity(intent);
                } catch (Exception e) {
                    Toast.makeText(context, "تطبيق واتساب غير مثبت!", Toast.LENGTH_SHORT).show();
                }
            } else {
                Toast.makeText(context, "رقم الهاتف غير متوفر لهذا الزبون", Toast.LENGTH_SHORT).show();
            }
        });

        // زر تفاصيل الطلب (يمكن برمجته لاحقاً لفتح صفحة كاملة)
        holder.btnDetails.setOnClickListener(v -> {
            Toast.makeText(context, "تفاصيل الطلب #" + order.getId(), Toast.LENGTH_SHORT).show();
        });
    }

    @Override
    public int getItemCount() {
        return orderList.size();
    }

    public static class OrderViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderId, tvCustomerName, tvOrderTotal, tvStatus;
        Button btnWhatsapp, btnDetails;

        public OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            tvOrderId = itemView.findViewById(R.id.tv_order_id);
            tvCustomerName = itemView.findViewById(R.id.tv_customer_name);
            tvOrderTotal = itemView.findViewById(R.id.tv_order_total);
            tvStatus = itemView.findViewById(R.id.tv_order_status);
            btnWhatsapp = itemView.findViewById(R.id.btn_whatsapp);
            btnDetails = itemView.findViewById(R.id.btn_view_details);
        }
    }
}
