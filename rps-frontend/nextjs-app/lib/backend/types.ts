export type BackendCompany = {
  id: number;
  name: string;
  created_at: string;
};

export type BackendQuestion = {
  id: number;
  question_text: string;
  question_type: string | null;
  rps_dimension: string | null;
  choice_options?: string[] | null;
  order_index: number;
  created_at: string;
};

export type BackendCampaign = {
  id: number;
  name: string;
  description?: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  company: BackendCompany;
  questions: BackendQuestion[];
};

export type BackendEmployee = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  department: string | null;
  survey_token: string | null;
  created_at: string;
  company: BackendCompany;
  responses?: BackendResponse[];
};

export type BackendResponse = {
  id: number;
  answer: string;
  created_at: string;
  employee?: Pick<BackendEmployee, "id" | "first_name" | "last_name" | "email" | "department">;
  question: BackendQuestion;
};

export type BackendReport = {
  id: number;
  report_path: string;
  created_at: string;
  campaign: Pick<BackendCampaign, "id" | "name" | "status" | "start_date" | "end_date">;
};

export type BackendQuestionnaire = {
  token: string;
  status: string;
  completed_at: string | null;
  employee: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    department: string | null;
  };
  campaign: {
    id: number;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    company?: {
      id: number;
      name: string;
      created_at?: string;
    };
  };
  questions: BackendQuestion[];
};

export type BackendCampaignParticipant = {
  id: number;
  participation_token: string;
  status: "pending" | "reminded" | "completed";
  invitation_sent_at: string | null;
  reminder_sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  employee: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    department: string | null;
  };
};

export type BackendCampaignProgress = {
  campaign_id: number;
  total_participants: number;
  completed_participants: number;
  pending_participants: number;
  reminded_participants: number;
  participation_rate: number;
  participants: BackendCampaignParticipant[];
};
