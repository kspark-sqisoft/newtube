import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { useUser, useClerk } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { commentInsertSchema } from "@/db/schema";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { trpc } from "@/trpc/client";

interface CommentFormProps {
    videoId: string;
    parentId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
    variant?: "comment" | "reply";
}

const CommentForm = ({
    videoId,
    parentId,
    onCancel,
    variant = "comment",
    onSuccess, }: CommentFormProps) => {
    const { user } = useUser();
    const clerk = useClerk();
    const utils = trpc.useUtils();

    const create = trpc.comments.create.useMutation({
        onSuccess: () => {
            utils.comments.getMany.invalidate({ videoId });
            utils.comments.getMany.invalidate({ videoId, parentId });

            toast.success("Comment created");
            form.reset();
            onSuccess?.();
        },
        onError: (error) => {
            toast.error("Something went wrong");
            if (error.data?.code === "UNAUTHORIZED") {
                clerk.openSignIn();
            }
        }
    });

    const formSchema = commentInsertSchema.omit({ userId: true });
    type FormValues = z.infer<typeof formSchema>;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            parentId,
            videoId,
            value: ""
        }
    });

    const handleSubmit = (values: FormValues) => {
        create.mutate({
            ...values,
            parentId: parentId || undefined,
        });
    };

    const handleCancel = () => {
        form.reset();
        onCancel?.();
    };


    return (
        <Form {...form}>
            <form className="flex gap-4 group" onSubmit={form.handleSubmit(handleSubmit)}>
                <UserAvatar
                    size="lg"
                    imageUrl={user?.imageUrl || "/user-placeholder.svg"}
                    name={user?.username || "User"}
                />
                <div className="flex-1">
                    <FormField name="value" control={form.control} render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    placeholder={variant === "comment" ? "Add a comment..." : "Reply to this comment..."}
                                    className="resize-none bg-transparent overflow-hidden min-h-0"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <div className="justify-end gap-2 mt-2 flex">
                        {onCancel && (
                            <Button variant="ghost" type="button" size="sm" onClick={handleCancel}>
                                Cancel
                            </Button>
                        )}
                        <Button type="submit" size="sm" disabled={create.isPending}>
                            {variant === "comment" ? "Comment" : "Reply"}
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
    );
};

export default CommentForm;