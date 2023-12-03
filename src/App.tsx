import { useEffect, useRef, useState } from 'react';
import Select from 'react-select';
import axios, { AxiosResponse } from 'axios';
import { ErrorMessage, Field, Form, Formik, FormikHelpers } from 'formik';
import './styles.css';

const baseURL = 'https://abzagency-test-production.up.railway.app/api/v1';
// const baseURL = 'http://localhost:3000/api/v1';

const TOKEN_ERROR_MESSAGE =
  'Cannot authorize to create user please try again and verify your internet connection';

type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  photo: string;
  position: string;
  position_id: number;
  registration_timestamp: number;
};

type CreateUserFields = 'name' | 'email' | 'phone' | 'photo' | 'position_id';
type CreateUser = Pick<User, CreateUserFields>;

type GetUserResponse = {
  success: boolean;
  page?: number | undefined;
  offset?: number | undefined;
  total_pages: number;
  total_users: number;
  count: number;
  links: {
    next_url: string | null;
    prev_url: string | null;
  };
  users: User[];
};

type ResponseCreatedUser = {
  success: boolean;
  message: string;
  user_id: string;
};

type ResponseValidationError = {
  success: boolean;
  message: string;
  fails: {
    [key in CreateUserFields]?: string[];
  };
};

type ResponseToken = {
  success: boolean;
  token: string;
};

type Position = {
  id: number;
  name: string;
};

type PositionOption = {
  value: number;
  label: string;
};

type GetPositionsResponse = {
  success: boolean;
  positions: Position[];
};

export default function App() {
  const [currPage, setCurrPage] = useState<string>(`${baseURL}/users?page=1&count=6`);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  /** Create User */
  const [seen, setSeen] = useState<boolean>(false);
  const [token, _setToken] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<PositionOption | null>(null);
  const tokenRef = useRef(token);
  const fileRef = useRef<any>(null);

  useEffect(() => {
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();

    axios
      .get<GetUserResponse>(currPage, { cancelToken: source.token })
      .then(res => {
        setUsers(currentUsers => currentUsers.concat(res.data.users));
        setNextPage(res.data.links.next_url);
      })
      .catch(err => {
        if (axios.isCancel(err)) {
          console.log('Request successfully canceled', err.message);
        } else {
          console.log(err);
          alert('Check your internet connection');
        }
      });

    return () => {
      source.cancel();
    };
  }, [currPage]);

  useEffect(() => {
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();

    axios
      .get<GetPositionsResponse>(`${baseURL}/positions`, { cancelToken: source.token })
      .then(res => {
        setPositions(res.data.positions);
      })
      .catch(err => {
        if (axios.isCancel(err)) {
          console.log('Request successfully canceled', err.message);
        } else {
          console.log(err);
          alert('Check your internet connection');
        }
      });

    return () => {
      source.cancel();
    };
  }, []);

  const setToken = (newToken: typeof token) => {
    tokenRef.current = newToken;
    _setToken(newToken);
  };

  const togglePopCreateUser = () => {
    setSeen(!seen);
  };

  const getToken = (): Promise<AxiosResponse<ResponseToken>> => {
    return axios.get<ResponseToken>(`${baseURL}/token`);
  };

  const onClickUserCreate = () => {
    getToken()
      .then(res => {
        setToken(res.data.token);
        togglePopCreateUser();
      })
      .catch(err => {
        alert(TOKEN_ERROR_MESSAGE);
        console.log('Cannot get token from server', err.message);
      });
  };

  const reqCreateUser = async (
    values: CreateUser,
    formikHelper: FormikHelpers<CreateUser>,
  ): Promise<any> => {
    let userToken = tokenRef.current;
    if (!userToken) {
      try {
        const tokenRes = await getToken();
        userToken = tokenRes.data.token;
        setToken(tokenRes.data.token);
      } catch (err) {
        alert(TOKEN_ERROR_MESSAGE);
        console.log('Cannot get token from server', err);
        togglePopCreateUser();
        return;
      }
    }

    try {
      const res = await axios.postForm<ResponseCreatedUser>(
        `${baseURL}/users`,
        {
          ...values,
          position_id: selectedPosition?.value,
          photo: fileRef.current.files[0],
        },
        {
          headers: {
            Token: userToken,
          },
        },
      );

      const userId = res.data.user_id;
      const { data: user } = await axios.get<User>(`${baseURL}/users/${userId}`);
      setUsers(currentUsers => [user, ...currentUsers]);

      togglePopCreateUser();

      alert('Successfully created user');
    } catch (error: any) {
      const { status } = error.response;
      const { success, fails } = error.response.data;
      if (status === 422 && !success && fails) {
        const { fails } = error.response.data as ResponseValidationError;

        for (const [key, value] of Object.entries(fails)) {
          console.log('key: ' + key + ' value: ' + value);

          formikHelper.setFieldError(key, value.join('. '));
        }
      }
      if (status === 401 && !success) {
        alert('Your token has expired and will be updated now.');
        setToken(null);
        return reqCreateUser(values, formikHelper);
      }
    } finally {
      setToken(null);
    }
  };

  return (
    <>
      <button onClick={onClickUserCreate}>
        <h2>Create new User</h2>
      </button>
      {seen ? (
        <div className="popup">
          <Formik
            // TODO: remove position_id attribute
            initialValues={{ name: '', email: '', phone: '', photo: '', position_id: 0 }}
            onSubmit={(values, formikHelpers) => reqCreateUser(values, formikHelpers)}
          >
            {({ isSubmitting }) => (
              <Form className="popup-inner">
                <h2>Create new User</h2>

                <Field type="text" name="name" placeholder="Enter your fullname" />
                <ErrorMessage name="name" component="div" />

                <Field type="email" name="email" placeholder="Enter email address" />
                <ErrorMessage name="email" component="div" />

                <Field type="tel" name="phone" placeholder="Enter phone" />
                <ErrorMessage name="phone" component="div" />

                <Select
                  className="position_id"
                  name="position_id"
                  defaultValue={selectedPosition}
                  onChange={setSelectedPosition}
                  options={positions.map(position => ({
                    value: position.id,
                    label: position.name,
                  }))}
                  isSearchable
                  placeholder="Please select a position"
                  noOptionsMessage={() => 'Please create positions in the database'}
                />
                <ErrorMessage name="position_id" component="div" />

                <label>Select image jpeg/jpg with maximum size 5 MB and minimum 70*70</label>
                <div>
                  <label htmlFor="files">Choose files</label>{' '}
                  <input ref={fileRef} type="file" name="photo" accept="image/jpg, image/jpeg" />
                </div>
                <ErrorMessage name="photo" component="div" />

                <button type="submit" disabled={isSubmitting}>
                  Submit
                </button>
                <button onClick={togglePopCreateUser}>Close</button>
              </Form>
            )}
          </Formik>
        </div>
      ) : null}
      <h1>Users!</h1>
      <ul>
        {users.map(user => (
          <li key={user.id} className="users-list">
            <h3>{user.name}</h3>
            {Object.entries(user).map(([key, value]) => (
              <p key={key} className="users-prop">{`${key}: ${value}`}</p>
            ))}
          </li>
        ))}
      </ul>
      {nextPage && (
        <button
          type="button"
          className="users-show-more-button"
          onClick={() => setCurrPage(nextPage)}
        >
          Show more
        </button>
      )}
    </>
  );
}
