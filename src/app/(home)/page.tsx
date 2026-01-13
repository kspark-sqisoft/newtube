import { HomeView } from "@/modules/home/ui/views/home-view";
import { trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    categoryId?: string;
  }>;
}

const Page = async ({ searchParams }: PageProps) => {
  const { categoryId } = await searchParams;

  void trpc.categories.getMany.prefetch();

  return <HomeView categoryId={categoryId} />;
};

export default Page;
