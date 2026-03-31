-- Create complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    admin_response TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fees table
CREATE TABLE IF NOT EXISTS public.fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    amount_due NUMERIC NOT NULL DEFAULT 0,
    amount_paid NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'unpaid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fee_payments table
CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_id UUID REFERENCES public.fees(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payment_method TEXT DEFAULT 'Cash'
);

-- Enable RLS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Policies for complaints
CREATE POLICY "Users can create their own complaints" ON public.complaints FOR INSERT WITH CHECK (auth.uid() = parent_id);
CREATE POLICY "Users can view their own complaints" ON public.complaints FOR SELECT USING (auth.uid() = parent_id);
CREATE POLICY "Admins can view all complaints" ON public.complaints FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update complaints (for replies)" ON public.complaints FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies for fees
CREATE POLICY "Parents can view their children's fees" ON public.fees FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.student_parents WHERE parent_id = auth.uid() AND student_id = fees.student_id)
);
CREATE POLICY "Admins can manage fees" ON public.fees FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Policies for fee_payments
CREATE POLICY "Parents can view their children's payments" ON public.fee_payments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.fees f 
        JOIN public.student_parents sp ON f.student_id = sp.student_id 
        WHERE f.id = fee_payments.fee_id AND sp.parent_id = auth.uid()
    )
);
CREATE POLICY "Admins can manage fee_payments" ON public.fee_payments FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
