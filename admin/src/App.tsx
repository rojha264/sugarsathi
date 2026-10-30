import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BookOutlined,
  BulbOutlined,
  CrownOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FireOutlined,
  LineChartOutlined,
  FilterOutlined,
  MessageOutlined,
  RocketOutlined,
  NotificationOutlined,
  ProfileOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { AuthPage, ErrorComponent, ThemedLayoutV2, ThemedSiderV2, ThemedTitleV2, useNotificationProvider } from '@refinedev/antd';
import '@refinedev/antd/dist/reset.css';
import { Authenticated, Refine, type AccessControlProvider } from '@refinedev/core';
import routerBindings, { CatchAllNavigate, DocumentTitleHandler, NavigateToResource, UnsavedChangesNotifier } from '@refinedev/react-router-v6';
import { App as AntApp, ConfigProvider } from 'antd';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Analytics } from './pages/Analytics';
import { AuditList, StaffList, SubscriptionPlans } from './pages/Owner';
import { Chats } from './pages/Chats';
import { KickstartList } from './pages/Kickstart';
import { ProgramList } from './pages/Programs';
import { ExerciseList, RuleList, TipList } from './pages/Content';
import { Dashboard } from './pages/Dashboard';
import { FoodEdit, FoodList, IngredientList } from './pages/Foods';
import { NotificationCompose, NotificationList, SegmentList } from './pages/Notifications';
import { PatientList } from './pages/PatientList';
import { PatientShow } from './pages/PatientShow';
import { TemplateList } from './pages/Templates';
import { ReelList } from './pages/Reels';
import { ThaliList } from './pages/Thalis';
import { session } from './providers/api';
import { authProvider } from './providers/authProvider';
import { dataProvider } from './providers/dataProvider';

const OWNER_ONLY = ['analytics', 'staff', 'subscription-plans', 'audit'];

/** Dietitians see clinical and content pages; staff, plans and audit are owner-only. */
const accessControl: AccessControlProvider = {
  can: async ({ resource }) => ({
    can: !OWNER_ONLY.includes(resource ?? '') || session.get()?.user.role === 'OWNER',
  }),
};

const Title = ({ collapsed }: { collapsed: boolean }) => <ThemedTitleV2 collapsed={collapsed} text="Sugar Saathi" icon={<span style={{ fontSize: 22 }}>🩸</span>} />;

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ConfigProvider theme={{ token: { colorPrimary: '#1E8A5A', borderRadius: 8 } }}>
          <AntApp>
            <Refine
              dataProvider={dataProvider}
              authProvider={authProvider}
              accessControlProvider={accessControl}
              routerProvider={routerBindings}
              notificationProvider={useNotificationProvider}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: false,
                disableTelemetry: true,
                title: { text: 'Sugar Saathi Admin' },
              }}
              resources={[
                {
                  name: 'dashboard',
                  list: '/',
                  meta: { label: 'Dashboard', icon: <DashboardOutlined /> },
                },
                {
                  name: 'patients',
                  list: '/patients',
                  show: '/patients/show/:id',
                  meta: { label: 'Patients', icon: <UserOutlined /> },
                },
                {
                  name: 'analytics',
                  list: '/analytics',
                  meta: { label: 'Analytics', icon: <LineChartOutlined /> },
                },
                {
                  name: 'kickstart',
                  list: '/kickstart',
                  meta: { label: 'Kickstart (14 days)', icon: <RocketOutlined /> },
                },
                {
                  name: 'chats',
                  list: '/chats',
                  meta: { label: 'Chats', icon: <MessageOutlined /> },
                },
                {
                  name: 'notifications',
                  list: '/notifications',
                  create: '/notifications/create',
                  meta: {
                    label: 'Notifications',
                    icon: <NotificationOutlined />,
                  },
                },
                {
                  name: 'segments',
                  list: '/segments',
                  meta: { label: 'Segments', icon: <FilterOutlined /> },
                },
                {
                  name: 'catalog',
                  meta: { label: 'Food & content', icon: <AppstoreOutlined /> },
                },
                {
                  name: 'foods',
                  list: '/foods',
                  create: '/foods/create',
                  edit: '/foods/edit/:id',
                  meta: {
                    parent: 'catalog',
                    label: 'Foods',
                    icon: <FireOutlined />,
                  },
                },
                {
                  name: 'ingredients',
                  list: '/ingredients',
                  meta: {
                    parent: 'catalog',
                    label: 'Ingredients',
                    icon: <ExperimentOutlined />,
                  },
                },
                {
                  name: 'diet-templates',
                  list: '/diet-templates',
                  meta: {
                    parent: 'catalog',
                    label: 'Diet templates',
                    icon: <ProfileOutlined />,
                  },
                },
                {
                  name: 'food-rules',
                  list: '/food-rules',
                  meta: {
                    parent: 'catalog',
                    label: 'Food rules',
                    icon: <AlertOutlined />,
                  },
                },
                {
                  name: 'programs',
                  list: '/programs',
                  meta: {
                    parent: 'catalog',
                    label: '14-day plans',
                    icon: <span>📅</span>,
                  },
                },
                {
                  name: 'reels',
                  list: '/reels',
                  meta: {
                    parent: 'catalog',
                    label: 'Reels (videos)',
                    icon: <span>🎬</span>,
                  },
                },
                {
                  name: 'thalis',
                  list: '/thalis',
                  meta: {
                    parent: 'catalog',
                    label: 'Thalis',
                    icon: <span>🍱</span>,
                  },
                },
                {
                  name: 'exercises',
                  list: '/exercises',
                  meta: {
                    parent: 'catalog',
                    label: 'Exercises',
                    icon: <BookOutlined />,
                  },
                },
                {
                  name: 'tips',
                  list: '/tips',
                  meta: {
                    parent: 'catalog',
                    label: 'Tips',
                    icon: <BulbOutlined />,
                  },
                },
                {
                  name: 'staff',
                  list: '/staff',
                  meta: { label: 'Staff', icon: <TeamOutlined /> },
                },
                {
                  name: 'subscription-plans',
                  list: '/subscription-plans',
                  meta: { label: 'Subscriptions', icon: <CrownOutlined /> },
                },
                {
                  name: 'audit',
                  list: '/audit',
                  meta: { label: 'Audit log', icon: <AuditOutlined /> },
                },
              ]}
            >
              <Routes>
                <Route
                  element={
                    <Authenticated key="app" fallback={<CatchAllNavigate to="/login" />}>
                      <ThemedLayoutV2 Title={Title} Sider={() => <ThemedSiderV2 Title={Title} fixed />}>
                        <Outlet />
                      </ThemedLayoutV2>
                    </Authenticated>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="/patients">
                    <Route index element={<PatientList />} />
                    <Route path="show/:id" element={<PatientShow />} />
                  </Route>
                  <Route path="/notifications">
                    <Route index element={<NotificationList />} />
                    <Route path="create" element={<NotificationCompose />} />
                  </Route>
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/chats/:id" element={<Chats />} />
                  <Route path="/segments" element={<SegmentList />} />
                  <Route path="/foods">
                    <Route index element={<FoodList />} />
                    <Route path="create" element={<FoodEdit />} />
                    <Route path="edit/:id" element={<FoodEdit />} />
                  </Route>
                  <Route path="/ingredients" element={<IngredientList />} />
                  <Route path="/diet-templates" element={<TemplateList />} />
                  <Route path="/food-rules" element={<RuleList />} />
                  <Route path="/thalis" element={<ThaliList />} />
                  <Route path="/reels" element={<ReelList />} />
                  <Route path="/programs" element={<ProgramList />} />
                  <Route path="/kickstart" element={<KickstartList />} />
                  <Route path="/exercises" element={<ExerciseList />} />
                  <Route path="/tips" element={<TipList />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/staff" element={<StaffList />} />
                  <Route path="/subscription-plans" element={<SubscriptionPlans />} />
                  <Route path="/audit" element={<AuditList />} />
                  <Route path="*" element={<ErrorComponent />} />
                </Route>
                <Route
                  element={
                    <Authenticated key="auth" fallback={<Outlet />}>
                      <NavigateToResource resource="dashboard" />
                    </Authenticated>
                  }
                >
                  <Route
                    path="/login"
                    element={
                      <AuthPage
                        type="login"
                        title={<h2 style={{ textAlign: 'center' }}>🩸 Sugar Saathi Admin</h2>}
                        registerLink={false}
                        forgotPasswordLink={false}
                        formProps={{
                          initialValues: {
                            email: 'dietitian1@glucobuddy.local',
                            password: 'Admin@123',
                          },
                        }}
                      />
                    }
                  />
                </Route>
              </Routes>
              <UnsavedChangesNotifier />
              <DocumentTitleHandler handler={() => 'Sugar Saathi Admin'} />
            </Refine>
          </AntApp>
        </ConfigProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
