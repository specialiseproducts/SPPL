import MyOrdersTab from './orderProcessing/MyOrdersTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export default function OrderProcessing() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[#212529] mb-2">Order Processing</h1>
      </div>

      <Tabs defaultValue="my-orders" className="w-full">
        <TabsList className="grid w-full max-w-xs" style={{ gridTemplateColumns: '1fr' }}>
          <TabsTrigger value="my-orders">My Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="my-orders" className="mt-6 outline-none">
          <MyOrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
