package com.db.dbworld.services;

import com.db.dbworld.dao.user.UserRepository;
import com.db.dbworld.entities.user.UserEntity;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.services.Impl.UserDetailImpl;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class SecurityUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ModelMapper modelMapper;

    /**
     * @param email
     * @return
     * @throws UsernameNotFoundException
     */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        UserEntity userEntity = this.userRepository.findByEmail(email).orElseThrow(()->new ResourceNotFoundException("User", "email", email));
        userEntity.setPassword(passwordEncoder.encode(userEntity.getPassword()));
        return this.modelMapper.map(userEntity, UserDetailImpl.class);
    }
}
