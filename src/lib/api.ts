import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_V1_BASE_URL = `${API_BASE_URL.replace(/\/$/, '')}/api/v1`;

// Types matching backend schemas exactly
export interface JobCreateRequest {
    subreddit: string;
    tts_provider: string;
    custom_title?: string;
    custom_story?: string;
}

export interface JobLogResponse {
    stage: string;
    message: string;
    timestamp: string;
}

export interface JobResponse {
    id: number;
    status: string;
    subreddit: string;
    script: string | null;
    tts_provider: string;
    video_url: string | null;
    uploaded_video_url: string | null;
    video_upload_status: string;
    error_message: string | null;
    source_title: string | null;
    source_post_id: string | null;
    source_permalink: string | null;
    attempts: number;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
}

export interface JobDetailResponse extends JobResponse {
    logs: JobLogResponse[];
}

export interface JobListResponse {
    jobs: JobResponse[];
}

export interface JobAccessResponse {
    url: string;
    expires_in_seconds: number | null;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
}

export interface UserResponse {
    id: number;
    email: string;
    credits: number;
    created_at: string;
    email_verified: boolean;
    is_admin: boolean;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
}

export interface VerifyEmailRequest {
    token: string;
}

export interface ResendVerificationRequest {
    email: string;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface ResetPasswordRequest {
    token: string;
    new_password: string;
}

export interface MessageResponse {
    message: string;
}

export interface AdminUserResponse {
    id: number;
    email: string;
    credits: number;
    is_admin: boolean;
    email_verified: boolean;
}

export interface AdminUserDetailResponse extends AdminUserResponse {
    created_at: string;
}

export interface AdminCreditSetRequest {
    credits: number;
    reason?: string;
}

export interface AdminCreditAdjustRequest {
    delta: number;
    reason?: string;
}

export interface AdminCreditAdjustmentResponse {
    id: number;
    target_user_id: number;
    target_email: string;
    admin_user_id: number;
    admin_email: string;
    old_credits: number;
    new_credits: number;
    delta: number;
    reason: string | null;
    created_at: string;
}

export interface AdminCreditAdjustmentListResponse {
    adjustments: AdminCreditAdjustmentResponse[];
}

// API client with authentication
class ApiClient {
    private token: string | null = null;

    private getHeaders() {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    setToken(token: string) {
        this.token = token;
    }

    clearToken() {
        this.token = null;
    }

    async login(credentials: LoginRequest): Promise<TokenResponse> {
        const response = await axios.post(`${API_V1_BASE_URL}/auth/login`, credentials);
        if (response.data.access_token) {
            this.setToken(response.data.access_token);
        }
        return response.data;
    }

    async register(userData: RegisterRequest): Promise<MessageResponse> {
        const response = await axios.post(`${API_V1_BASE_URL}/auth/register`, userData);
        return response.data;
    }

    async verifyEmail(payload: VerifyEmailRequest): Promise<MessageResponse> {
        const response = await axios.post(`${API_V1_BASE_URL}/auth/verify-email`, payload);
        return response.data;
    }

    async resendVerification(payload: ResendVerificationRequest): Promise<MessageResponse> {
        const response = await axios.post(`${API_V1_BASE_URL}/auth/resend-verification`, payload);
        return response.data;
    }

    async forgotPassword(payload: ForgotPasswordRequest): Promise<MessageResponse> {
        const response = await axios.post(`${API_V1_BASE_URL}/auth/forgot-password`, payload);
        return response.data;
    }

    async resetPassword(payload: ResetPasswordRequest): Promise<MessageResponse> {
        const response = await axios.post(`${API_V1_BASE_URL}/auth/reset-password`, payload);
        return response.data;
    }

    async getCurrentUser(): Promise<UserResponse> {
        const response = await axios.get(`${API_V1_BASE_URL}/auth/me`, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async createJob(jobData: JobCreateRequest): Promise<JobResponse> {
        const response = await axios.post(`${API_V1_BASE_URL}/jobs`, jobData, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async getJobs(): Promise<JobResponse[]> {
        const response = await axios.get(`${API_V1_BASE_URL}/jobs`, {
            headers: this.getHeaders(),
        });
        return response.data.jobs;
    }

    async getJob(jobId: number): Promise<JobDetailResponse> {
        const response = await axios.get(`${API_V1_BASE_URL}/jobs/${jobId}`, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async getJobAccess(jobId: number): Promise<JobAccessResponse> {
        const response = await axios.get(`${API_V1_BASE_URL}/jobs/${jobId}/access`, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async searchAdminUsers(emailPrefix: string): Promise<AdminUserResponse[]> {
        const response = await axios.get(`${API_V1_BASE_URL}/admin/users/search`, {
            headers: this.getHeaders(),
            params: { email_prefix: emailPrefix },
        });
        return response.data;
    }

    async getAdminUser(userId: number): Promise<AdminUserDetailResponse> {
        const response = await axios.get(`${API_V1_BASE_URL}/admin/users/${userId}`, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async setAdminUserCredits(userId: number, payload: AdminCreditSetRequest): Promise<AdminCreditAdjustmentResponse> {
        const response = await axios.put(`${API_V1_BASE_URL}/admin/users/${userId}/credits`, payload, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async adjustAdminUserCredits(userId: number, payload: AdminCreditAdjustRequest): Promise<AdminCreditAdjustmentResponse> {
        const response = await axios.post(`${API_V1_BASE_URL}/admin/users/${userId}/credits/adjust`, payload, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async getAdminUserCreditHistory(userId: number, limit = 20): Promise<AdminCreditAdjustmentResponse[]> {
        const response = await axios.get(`${API_V1_BASE_URL}/admin/users/${userId}/credits/history`, {
            headers: this.getHeaders(),
            params: { limit },
        });
        return (response.data as AdminCreditAdjustmentListResponse).adjustments;
    }

    isAuthenticated(): boolean {
        return !!this.token;
    }
}

export const api = new ApiClient();
