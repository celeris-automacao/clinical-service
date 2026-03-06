export interface UserContext {
    userId: string;
    tenantId: string;
    role: string;
}
export declare const GetUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
